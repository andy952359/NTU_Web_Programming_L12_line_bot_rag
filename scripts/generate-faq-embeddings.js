import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { faqToEmbeddingInput, validateFaqs } from "../lib/faq-search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const faqPath = path.join(projectRoot, "data", "faqs.json");
const outputPath = path.join(projectRoot, "data", "faq-embeddings.json");
const model = "text-embedding-3-small";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate FAQ embeddings");
  }

  const faqs = JSON.parse(await fs.readFile(faqPath, "utf8"));
  validateFaqs(faqs);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model,
    input: faqs.map(faqToEmbeddingInput)
  });

  const embeddedFaqs = faqs.map((faq, index) => ({
    ...faq,
    embeddingModel: model,
    embedding: response.data[index].embedding
  }));

  await fs.writeFile(outputPath, `${JSON.stringify(embeddedFaqs, null, 2)}\n`, "utf8");
  console.log(`Generated ${embeddedFaqs.length} FAQ embeddings at ${path.relative(projectRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});