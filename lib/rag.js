import OpenAI from "openai";
import faqs from "../data/faqs.json" with { type: "json" };
import { faqToEmbeddingInput, searchFaqs, validateFaqs } from "./faq-search.js";

const defaultEmbeddingModel = "text-embedding-3-small";
const defaultChatModel = "gpt-4o-mini";
const defaultFallbackText = "目前資料中沒有相關資訊，建議聯繫客服確認。";
const defaultErrorText = "目前系統暫時無法查詢資料，請稍後再試。";

let cachedFaqEmbeddingsPromise;

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for RAG replies");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 8000
  });
}

function parseScore(value, fallback) {
  const score = Number.parseFloat(value);
  return Number.isFinite(score) ? score : fallback;
}

function formatContext(matchedFaqs) {
  return matchedFaqs
    .map((faq, index) => [
      `資料 ${index + 1}`,
      `分類：${faq.category}`,
      `問題：${faq.question}`,
      `答案：${faq.answer}`
    ].join("\n"))
    .join("\n\n");
}

async function createFaqEmbeddings({ openai, faqItems, embeddingModel }) {
  validateFaqs(faqItems);

  const response = await openai.embeddings.create({
    model: embeddingModel,
    input: faqItems.map(faqToEmbeddingInput)
  });

  return faqItems.map((faq, index) => ({
    ...faq,
    embeddingModel,
    embedding: response.data[index].embedding
  }));
}

async function getFaqEmbeddings({ openai, faqItems, embeddingModel }) {
  if (!cachedFaqEmbeddingsPromise) {
    cachedFaqEmbeddingsPromise = createFaqEmbeddings({ openai, faqItems, embeddingModel });
  }

  return cachedFaqEmbeddingsPromise;
}

export function resetFaqEmbeddingCache() {
  cachedFaqEmbeddingsPromise = undefined;
}

export function createRagResponder({
  openai,
  faqItems = faqs,
  embeddingModel = defaultEmbeddingModel,
  chatModel = process.env.OPENAI_CHAT_MODEL || defaultChatModel,
  topK = 3,
  minScore = parseScore(process.env.RAG_MIN_SCORE, 0.35),
  fallbackText = defaultFallbackText,
  errorText = defaultErrorText
} = {}) {
  let openaiClient = openai;

  return async function answerWithRag(userMessage) {
    const question = userMessage.trim();

    if (!question) {
      return "請輸入想詢問的文字問題。";
    }

    try {
      openaiClient ??= getOpenAiClient();

      const faqEmbeddings = await getFaqEmbeddings({ openai: openaiClient, faqItems, embeddingModel });
      const queryEmbeddingResponse = await openaiClient.embeddings.create({
        model: embeddingModel,
        input: question
      });

      const matchedFaqs = searchFaqs({
        queryEmbedding: queryEmbeddingResponse.data[0].embedding,
        faqEmbeddings,
        topK,
        minScore
      });

      if (matchedFaqs.length === 0) {
        return fallbackText;
      }

      const completion = await openaiClient.chat.completions.create({
        model: chatModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: [
              "你是客服 FAQ 助理。",
              "只能根據提供的資料回答。",
              "如果資料不足，請明確說目前資料中沒有相關資訊。",
              "不要編造政策、日期、付款方式或訂單狀態。",
              "請用繁體中文，回答保持簡潔自然。"
            ].join("\n")
          },
          {
            role: "user",
            content: [
              `使用者問題：${question}`,
              "可用資料：",
              formatContext(matchedFaqs)
            ].join("\n\n")
          }
        ]
      });

      return completion.choices[0]?.message?.content?.trim() || fallbackText;
    } catch (error) {
      cachedFaqEmbeddingsPromise = undefined;
      console.error("RAG reply error:", error);
      return errorText;
    }
  };
}