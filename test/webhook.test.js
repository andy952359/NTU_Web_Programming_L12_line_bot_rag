import { EventEmitter } from "node:events";
import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { createWebhookHandler } from "../api/webhook.js";

process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
process.env.LINE_CHANNEL_SECRET = "test-secret";

const replyMessageMock = mock.fn(() => Promise.resolve({}));
const handler = createWebhookHandler({
  createClient: () => ({
    replyMessage: replyMessageMock
  }),
  createTextReply: async (text) => `RAG:${text}`,
  isValidSignature: (body, secret, signature) => (
    body.length > 0 && secret === "test-secret" && signature === "valid-signature"
  )
});

function createRequest({ method = "POST", body = "", signature } = {}) {
  const request = new EventEmitter();
  request.method = method;
  request.headers = signature ? { "x-line-signature": signature } : {};

  request.start = () => {
    request.emit("data", Buffer.from(body));
    request.emit("end");
  };

  return request;
}

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
      this.finished = true;
    }
  };
}

async function invoke(request, response) {
  const promise = handler(request, response);
  request.start?.();
  await promise;
  return response;
}

function sign(body) {
  return body.length > 0 ? "valid-signature" : "invalid";
}

test("rejects non-POST requests", async () => {
  const request = createRequest({ method: "GET" });
  const response = await invoke(request, createResponse());

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), { error: "Method not allowed" });
});

test("rejects invalid LINE signatures", async () => {
  const body = JSON.stringify({ events: [] });
  const request = createRequest({ body, signature: "invalid" });
  const response = await invoke(request, createResponse());

  assert.equal(response.statusCode, 401);
  assert.deepEqual(JSON.parse(response.body), { error: "Invalid LINE signature" });
});

test("replies to text messages", async () => {
  replyMessageMock.mock.resetCalls();

  const body = JSON.stringify({
    events: [
      {
        type: "message",
        replyToken: "reply-token",
        message: {
          type: "text",
          text: "hello"
        }
      }
    ]
  });

  const request = createRequest({ body, signature: sign(body) });
  const response = await invoke(request, createResponse());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  assert.equal(replyMessageMock.mock.callCount(), 1);
  assert.deepEqual(replyMessageMock.mock.calls[0].arguments[0], {
    replyToken: "reply-token",
    messages: [
      {
        type: "text",
        text: "RAG:hello"
      }
    ]
  });
});

test("replies with fallback for non-text messages", async () => {
  replyMessageMock.mock.resetCalls();

  const body = JSON.stringify({
    events: [
      {
        type: "message",
        replyToken: "reply-token",
        message: {
          type: "sticker"
        }
      }
    ]
  });

  const request = createRequest({ body, signature: sign(body) });
  const response = await invoke(request, createResponse());

  assert.equal(response.statusCode, 200);
  assert.equal(replyMessageMock.mock.callCount(), 1);
  assert.equal(
    replyMessageMock.mock.calls[0].arguments[0].messages[0].text,
    "目前只支援文字訊息。"
  );
});