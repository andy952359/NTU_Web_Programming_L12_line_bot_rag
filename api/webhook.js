import { messagingApi, validateSignature } from "@line/bot-sdk";

const { MessagingApiClient } = messagingApi;

function getRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function jsonResponse(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function assertLineConfig() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || !channelSecret) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET are required");
  }

  return { channelAccessToken, channelSecret };
}

async function replyToEvent(client, event) {
  if (event.type !== "message" || !event.replyToken) {
    return;
  }

  const text = event.message?.type === "text"
    ? "我收到你的訊息了"
    : "目前只支援文字訊息。";

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text
      }
    ]
  });
}

export function createWebhookHandler({
  createClient = (channelAccessToken) => new MessagingApiClient({ channelAccessToken }),
  isValidSignature = validateSignature
} = {}) {
  return async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    jsonResponse(response, 405, { error: "Method not allowed" });
    return;
  }

  let body;
  let lineConfig;

  try {
    lineConfig = assertLineConfig();
    body = await getRawBody(request);
  } catch (error) {
    console.error("Webhook setup error:", error);
    jsonResponse(response, 500, { error: "Webhook is not configured" });
    return;
  }

  const signature = request.headers["x-line-signature"];

  if (!signature || !isValidSignature(body, lineConfig.channelSecret, signature)) {
    jsonResponse(response, 401, { error: "Invalid LINE signature" });
    return;
  }

  let payload;

  try {
    payload = JSON.parse(body);
  } catch (error) {
    console.error("Invalid webhook JSON:", error);
    jsonResponse(response, 400, { error: "Invalid JSON" });
    return;
  }

  const client = createClient(lineConfig.channelAccessToken);
  const events = Array.isArray(payload.events) ? payload.events : [];

  try {
    await Promise.all(events.map((event) => replyToEvent(client, event)));
    jsonResponse(response, 200, { ok: true });
  } catch (error) {
    console.error("LINE reply error:", error);
    jsonResponse(response, 500, { error: "Failed to reply LINE message" });
  }
  };
}

export default createWebhookHandler();

export const config = {
  api: {
    bodyParser: false
  }
};