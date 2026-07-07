import { test } from "node:test";
import assert from "node:assert/strict";
import { createRagResponder, resetFaqEmbeddingCache } from "../lib/rag.js";

test("RAG responder searches FAQ embeddings and answers with chat completion", async () => {
  resetFaqEmbeddingCache();

  const embeddingCalls = [];
  const openai = {
    embeddings: {
      create: async ({ input }) => {
        embeddingCalls.push(input);

        if (Array.isArray(input)) {
          return {
            data: [
              { embedding: [1, 0] },
              { embedding: [0, 1] }
            ]
          };
        }

        return { data: [{ embedding: [1, 0] }] };
      }
    },
    chat: {
      completions: {
        create: async ({ messages }) => ({
          choices: [
            {
              message: {
                content: messages[1].content.includes("商品可以退貨嗎？")
                  ? "商品收到後七天內可以申請退貨。"
                  : "目前資料中沒有相關資訊。"
              }
            }
          ]
        })
      }
    }
  };

  const answer = await createRagResponder({
    openai,
    faqItems: [
      {
        id: "faq-return-001",
        question: "商品可以退貨嗎？",
        answer: "商品收到後七天內可以申請退貨。",
        category: "return"
      },
      {
        id: "faq-payment-001",
        question: "可以使用哪些付款方式？",
        answer: "目前支援信用卡付款。",
        category: "payment"
      }
    ],
    minScore: 0.5
  })("能退貨嗎？");

  assert.equal(answer, "商品收到後七天內可以申請退貨。");
  assert.equal(embeddingCalls.length, 2);
});

test("RAG responder returns fallback when similarity is too low", async () => {
  resetFaqEmbeddingCache();

  const openai = {
    embeddings: {
      create: async ({ input }) => {
        if (Array.isArray(input)) {
          return { data: [{ embedding: [1, 0] }] };
        }

        return { data: [{ embedding: [0, 1] }] };
      }
    },
    chat: {
      completions: {
        create: async () => {
          throw new Error("Chat should not be called below threshold");
        }
      }
    }
  };

  const answer = await createRagResponder({
    openai,
    faqItems: [
      {
        id: "faq-return-001",
        question: "商品可以退貨嗎？",
        answer: "商品收到後七天內可以申請退貨。",
        category: "return"
      }
    ],
    minScore: 0.5,
    fallbackText: "沒有資料"
  })("可以用比特幣付款嗎？");

  assert.equal(answer, "沒有資料");
});

test("RAG responder returns a friendly message on OpenAI errors", async () => {
  resetFaqEmbeddingCache();

  const answer = await createRagResponder({
    openai: {
      embeddings: {
        create: async () => {
          throw new Error("Request timed out");
        }
      }
    },
    faqItems: [
      {
        id: "faq-return-001",
        question: "商品可以退貨嗎？",
        answer: "商品收到後七天內可以申請退貨。",
        category: "return"
      }
    ],
    errorText: "暫時無法查詢"
  })("能退貨嗎？");

  assert.equal(answer, "暫時無法查詢");
});