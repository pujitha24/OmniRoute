import test from "node:test";
import assert from "node:assert/strict";

import { DefaultExecutor } from "../../open-sse/executors/default.ts";

// #18007: forceStream providers (WorkBuddy) reject an explicit `stream:false` in the body
// (gateway code 11101); chatCore drains the SSE back to JSON, so upstream must get stream:true.

const body = () => ({
  model: "kimi-k3",
  stream: false,
  messages: [{ role: "user", content: "hi" }],
});

test("forceStream provider rewrites explicit stream:false to stream:true upstream", () => {
  const out = new DefaultExecutor("workbuddy").transformRequest("kimi-k3", body(), true, {});
  assert.equal(out.stream, true);
  assert.deepEqual(out.stream_options, { include_usage: true });
});

test("non-forceStream provider keeps explicit stream:false", () => {
  const out = new DefaultExecutor("openai").transformRequest("gpt-4o", body(), true, {});
  assert.equal(out.stream, false);
  assert.equal(out.stream_options, undefined);
});

test("forceStream provider with disableStreamOptions still gets stream:true and no stream_options", () => {
  const out = new DefaultExecutor("workbuddy").transformRequest("kimi-k3", body(), true, {
    providerSpecificData: { disableStreamOptions: true },
  });
  assert.equal(out.stream, true);
  assert.equal(out.stream_options, undefined);
});
