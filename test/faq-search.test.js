import { test } from "node:test";
import assert from "node:assert/strict";
import faqs from "../data/faqs.json" with { type: "json" };
import {
  cosineSimilarity,
  faqToEmbeddingInput,
  searchFaqs,
  validateFaqs,
  validateFaqEmbeddings
} from "../lib/faq-search.js";

test("FAQ seed data matches the required Phase 2 schema", () => {
  validateFaqs(faqs);
  assert.equal(faqs.length >= 20, true);
});

test("faqToEmbeddingInput includes searchable FAQ fields", () => {
  const input = faqToEmbeddingInput(faqs[0]);

  assert.match(input, /分類：return/);
  assert.match(input, /問題：商品可以退貨嗎？/);
  assert.match(input, /答案：商品收到後七天內可以申請退貨/);
});

test("cosineSimilarity scores identical, unrelated, and zero vectors", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
  assert.equal(cosineSimilarity([0, 0, 0], [1, 0, 0]), 0);
});

test("searchFaqs returns the highest scoring FAQs first", () => {
  const faqEmbeddings = [
    {
      id: "faq-return-001",
      question: "商品可以退貨嗎？",
      answer: "商品收到後七天內可以申請退貨。",
      category: "return",
      embedding: [1, 0, 0]
    },
    {
      id: "faq-payment-001",
      question: "可以使用哪些付款方式？",
      answer: "目前支援信用卡、ATM 轉帳、超商代碼付款與 LINE Pay。",
      category: "payment",
      embedding: [0, 1, 0]
    },
    {
      id: "faq-shipping-001",
      question: "下單後多久會出貨？",
      answer: "完成付款後，現貨商品通常會在二到三個工作天內出貨。",
      category: "shipping",
      embedding: [0.2, 0, 0.8]
    }
  ];

  validateFaqEmbeddings(faqEmbeddings);

  const results = searchFaqs({
    queryEmbedding: [0.9, 0, 0.1],
    faqEmbeddings,
    topK: 2
  });

  assert.deepEqual(results.map((faq) => faq.id), ["faq-return-001", "faq-shipping-001"]);
  assert.equal(results.length, 2);
  assert.equal(results[0].score > results[1].score, true);
});

test("searchFaqs supports a minimum score threshold", () => {
  const results = searchFaqs({
    queryEmbedding: [1, 0],
    faqEmbeddings: [
      {
        id: "faq-return-001",
        question: "商品可以退貨嗎？",
        answer: "商品收到後七天內可以申請退貨。",
        category: "return",
        embedding: [1, 0]
      },
      {
        id: "faq-payment-001",
        question: "可以使用哪些付款方式？",
        answer: "目前支援信用卡。",
        category: "payment",
        embedding: [0, 1]
      }
    ],
    minScore: 0.5
  });

  assert.deepEqual(results.map((faq) => faq.id), ["faq-return-001"]);
});