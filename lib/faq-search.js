export function faqToEmbeddingInput(faq) {
  return [
    `分類：${faq.category}`,
    `問題：${faq.question}`,
    `答案：${faq.answer}`
  ].join("\n");
}

export function cosineSimilarity(leftVector, rightVector) {
  if (!Array.isArray(leftVector) || !Array.isArray(rightVector)) {
    throw new TypeError("Both vectors must be arrays");
  }

  if (leftVector.length !== rightVector.length) {
    throw new RangeError("Vectors must have the same dimensions");
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < leftVector.length; index += 1) {
    dotProduct += leftVector[index] * rightVector[index];
    leftMagnitude += leftVector[index] ** 2;
    rightMagnitude += rightVector[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function searchFaqs({ queryEmbedding, faqEmbeddings, topK = 5, minScore = -1 }) {
  if (!Array.isArray(faqEmbeddings)) {
    throw new TypeError("faqEmbeddings must be an array");
  }

  return faqEmbeddings
    .map((faq) => ({
      ...faq,
      score: cosineSimilarity(queryEmbedding, faq.embedding)
    }))
    .filter((faq) => faq.score >= minScore)
    .sort((leftFaq, rightFaq) => rightFaq.score - leftFaq.score)
    .slice(0, topK);
}

export function validateFaqs(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) {
    throw new Error("FAQ data must be a non-empty array");
  }

  for (const faq of faqs) {
    for (const field of ["id", "question", "answer", "category"]) {
      if (!faq[field] || typeof faq[field] !== "string") {
        throw new Error(`FAQ ${faq.id ?? "unknown"} is missing ${field}`);
      }
    }
  }
}

export function validateFaqEmbeddings(faqEmbeddings) {
  validateFaqs(faqEmbeddings);

  for (const faq of faqEmbeddings) {
    if (!Array.isArray(faq.embedding) || faq.embedding.length === 0) {
      throw new Error(`FAQ ${faq.id} is missing embedding`);
    }
  }
}