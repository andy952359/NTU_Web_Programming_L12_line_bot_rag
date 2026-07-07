# LINE Bot RAG MVP

Phase 1 implements a minimal LINE Messaging API webhook for Vercel.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the LINE channel values.

3. Start the local Vercel server:

   ```bash
   npm run dev
   ```

4. Deploy to Vercel and set the LINE Developers webhook URL to:

   ```text
   https://your-vercel-domain.vercel.app/api/webhook
   ```

## Phase 1 Behavior

- `POST /api/webhook` verifies the `x-line-signature` header.
- Text messages receive `我收到你的訊息了`.
- Non-text messages receive `目前只支援文字訊息。`.
- Non-POST requests are rejected with `405`.

## Phase 2 FAQ Embeddings

FAQ source data lives in `data/faqs.json`.

Generate local embedding cache after setting `OPENAI_API_KEY`:

```bash
npm run embed:faqs
```

This creates `data/faq-embeddings.json`, which is ignored by git because it can be regenerated from the FAQ source and OpenAI API.

The search utilities in `lib/faq-search.js` provide:

- FAQ schema validation
- embedding input formatting
- cosine similarity
- top-k FAQ search with a minimum score threshold