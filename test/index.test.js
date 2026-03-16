import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildFailurePayload,
  buildMessageContent,
  createCommandHandlers,
  parseChatTarget,
  writeDownloadedFile,
} from "../scripts/napcat-tools.js";

const tempDir = path.join(process.cwd(), ".test-temp");

test.after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

test("parseChatTarget parses direct and group ids", () => {
  assert.deepEqual(parseChatTarget("group", "123"), { isGroup: true, id: 123 });
  assert.deepEqual(parseChatTarget("direct", "user:456"), { isGroup: false, id: 456 });
});

test("buildMessageContent normalizes common segments", () => {
  const content = buildMessageContent([
    { type: "text", data: { text: "hello" } },
    { type: "at", data: { qq: "all" } },
    { type: "image", data: { url: "https://example.com/a.png" } },
    { type: "file", data: { name: "a.txt" }, file_id: "f1" },
  ]);

  assert.match(content, /hello/);
  assert.match(content, /@全体成员/);
  assert.match(content, /\[图片：https:\/\/example.com\/a.png\]/);
  assert.match(content, /\[文件：a.txt, ID:f1\]/);
});

test("buildFailurePayload keeps structured json error model", () => {
  assert.deepEqual(buildFailurePayload("失败", "details", "usage"), {
    success: false,
    error: "失败",
    details: "details",
    usage: "usage",
  });
});

test("writeDownloadedFile supports base64 response", async () => {
  mkdirSync(tempDir, { recursive: true });
  const savePath = path.join(tempDir, "base64.txt");
  const bytes = await writeDownloadedFile({ base64: Buffer.from("hello").toString("base64") }, savePath);

  assert.equal(bytes, 5);
  assert.equal(existsSync(savePath), true);
  assert.equal(readFileSync(savePath, "utf8"), "hello");
});

test("createCommandHandlers uses injected sendAction and ok", async () => {
  const calls = [];
  const outputs = [];
  const handlers = createCommandHandlers({
    async sendAction(action, params) {
      calls.push({ action, params });
      return { message_id: 1001 };
    },
    ok(message, data) {
      outputs.push({ message, data });
    },
    fail(message) {
      throw new Error(message);
    },
    defaultDownloadDir: tempDir,
  });

  await handlers.send_message(["group", "123", "hello", "world"]);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, "send_group_msg");
  assert.equal(calls[0].params.group_id, 123);
  assert.equal(outputs[0].message, "消息发送成功");
});
