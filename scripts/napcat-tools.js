#!/usr/bin/env node

/**
 * NapCat Tools - 命令行工具接口
 *
 * 供 OpenClaw Skill 调用的命令行工具。
 * 重点职责：主动调用 NapCat API，并以稳定 JSON 输出结果。
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DOWNLOAD_DIR = join(__dirname, "..", "temp");

function printJson(payload, isError = false) {
  const json = JSON.stringify(payload);
  if (isError) {
    console.error(json);
  } else {
    console.log(json);
  }
}

export function buildFailurePayload(message, details, usage) {
  return {
    success: false,
    error: message,
    ...(details ? { details } : {}),
    ...(usage ? { usage } : {}),
  };
}

function fail(message, details, usage) {
  printJson(buildFailurePayload(message, details, usage), true);
  process.exit(1);
}

function readConfig() {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  const configPath = join(home, ".openclaw", "openclaw.json");

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config.channels?.napcat || {};
  } catch (error) {
    fail("无法读取 OpenClaw 配置", error instanceof Error ? error.message : String(error));
  }
}

function getConnectionConfig() {
  const config = readConfig();
  const wsUrl = config.connection?.wsUrl || config.wsUrl;
  const accessToken = config.connection?.accessToken || config.accessToken;

  if (!wsUrl) {
    fail("NapCat wsUrl 未配置");
  }

  return { wsUrl, accessToken };
}

async function sendAction(action, params = {}) {
  const { wsUrl, accessToken } = getConnectionConfig();
  const WebSocket = (await import("ws")).default;

  return new Promise((resolvePromise, rejectPromise) => {
    const fullUrl = accessToken ? `${wsUrl}?access_token=${encodeURIComponent(accessToken)}` : wsUrl;
    const ws = new WebSocket(fullUrl);

    ws.on("open", () => {
      const echo = `napcat-tools-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      ws.send(JSON.stringify({ action, params, echo }));

      const timeout = setTimeout(() => {
        ws.close();
        rejectPromise(new Error(`请求超时: ${action}`));
      }, 30000);

      ws.on("message", (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.echo !== echo) return;

          clearTimeout(timeout);
          ws.close();

          if (response.retcode === 0 || response.status === "ok") {
            resolvePromise(response.data);
            return;
          }

          rejectPromise(new Error(response.message || response.wording || JSON.stringify(response)));
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          rejectPromise(error);
        }
      });
    });

    ws.on("error", (error) => {
      rejectPromise(error);
    });
  });
}

export function parseChatTarget(chatType, chatId) {
  if (!chatType || !chatId) {
    fail("参数不足", undefined, "<chat_type> <chat_id>");
  }

  const isGroup = chatType === "group";
  const id = chatId.startsWith("user:") ? parseInt(chatId.slice(5), 10) : parseInt(chatId, 10);

  if (Number.isNaN(id)) {
    fail("聊天 ID 非法", chatId);
  }

  return { isGroup, id };
}

function normalizeFileArg(filePath) {
  if (!filePath) return filePath;
  const resolvedPath = resolve(filePath);
  if (existsSync(resolvedPath)) {
    return pathToFileURL(resolvedPath).href;
  }
  return filePath;
}

export function buildMessageContent(message = []) {
  return (message || []).map((segment) => {
    if (segment.type === "text") return segment.data?.text || "";
    if (segment.type === "at") {
      const qqId = segment.data?.qq ?? segment.data?.user_id;
      return qqId === "all" || qqId === "everyone" ? " @全体成员 " : ` @${qqId || ""} `;
    }
    if (segment.type === "face") {
      const faceId = String(segment.data?.id ?? segment.data?.face_id ?? "0");
      return ` [表情:${faceId}] `;
    }
    if (segment.type === "image") {
      const url = segment.data?.url || segment.data?.file;
      const summary = segment.data?.summary;
      if (summary) return ` [图片：${summary}] `;
      if (typeof url === "string" && (url.startsWith("http") || url.startsWith("base64://"))) {
        return ` [图片：${url}] `;
      }
      return " [图片] ";
    }
    if (segment.type === "file") {
      const name = segment.data?.name || "unknown";
      const fileId = segment.data?.file_id || segment.file_id || "unknown";
      return `[文件：${name}, ID:${fileId}]`;
    }
    if (segment.type === "record") return " [语音] ";
    if (segment.type === "video") return " [视频] ";
    if (segment.type === "mface") return ` [商城表情：${segment.data?.summary || `ID:${segment.data?.emoji_id}`}] `;
    if (segment.type === "forward") return " [转发消息] ";
    if (segment.type === "xml" || segment.type === "json") return " [卡片消息] ";
    if (segment.type === "reply") return ` [回复:${segment.data?.id || ""}] `;
    return segment.type ? `[${segment.type}]` : "";
  }).join("").trim();
}

export async function writeDownloadedFile(result, savePath) {
  mkdirSync(dirname(savePath), { recursive: true });

  if (typeof result.base64 === "string" && result.base64.length > 0) {
    const buffer = Buffer.from(result.base64, "base64");
    writeFileSync(savePath, buffer);
    return buffer.length;
  }

  if (typeof result.file === "string" && existsSync(result.file)) {
    copyFileSync(result.file, savePath);
    return statSync(savePath).size;
  }

  if (typeof result.url === "string" && result.url.length > 0) {
    const response = await fetch(result.url);
    if (!response.ok) {
      throw new Error(`下载远程文件失败: HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(savePath, buffer);
    return buffer.length;
  }

  throw new Error("get_file 返回中缺少可下载的数据");
}

function ok(message, data = {}) {
  printJson({ success: true, message, data });
}

export function createCommandHandlers(deps = {}) {
  const runtime = {
    sendAction: deps.sendAction || sendAction,
    ok: deps.ok || ok,
    fail: deps.fail || fail,
    defaultDownloadDir: deps.defaultDownloadDir || DEFAULT_DOWNLOAD_DIR,
  };

  return {
  async send_message(args) {
    const chatType = args[0];
    const chatId = args[1];
    const message = args.slice(2).join(" ");
    if (!chatType || !chatId || !message) {
      runtime.fail("参数不足", undefined, "send_message <chat_type> <chat_id> <message>");
    }

    const { isGroup, id } = parseChatTarget(chatType, chatId);
    const result = await runtime.sendAction(isGroup ? "send_group_msg" : "send_private_msg", {
      [isGroup ? "group_id" : "user_id"]: id,
      message: [{ type: "text", data: { text: message } }],
    });
    runtime.ok("消息发送成功", result);
  },

  async send_file(args) {
    const chatType = args[0];
    const chatId = args[1];
    const filePath = args[2];
    const fileName = args[3] || basename(filePath || "");
    if (!chatType || !chatId || !filePath) {
      runtime.fail("参数不足", undefined, "send_file <chat_type> <chat_id> <file_path> [file_name]");
    }

    const { isGroup, id } = parseChatTarget(chatType, chatId);
    const result = await runtime.sendAction(isGroup ? "send_group_msg" : "send_private_msg", {
      [isGroup ? "group_id" : "user_id"]: id,
      message: [{ type: "file", data: { file: normalizeFileArg(filePath), name: fileName } }],
    });
    runtime.ok("文件发送成功", result);
  },

  async send_record(args) {
    const chatType = args[0];
    const chatId = args[1];
    const filePath = args[2];
    if (!chatType || !chatId || !filePath) {
      runtime.fail("参数不足", undefined, "send_record <chat_type> <chat_id> <file_path>");
    }

    const { isGroup, id } = parseChatTarget(chatType, chatId);
    const result = await runtime.sendAction(isGroup ? "send_group_msg" : "send_private_msg", {
      [isGroup ? "group_id" : "user_id"]: id,
      message: [{ type: "record", data: { file: normalizeFileArg(filePath) } }],
    });
    runtime.ok("语音发送成功", result);
  },

  async send_video(args) {
    const chatType = args[0];
    const chatId = args[1];
    const filePath = args[2];
    if (!chatType || !chatId || !filePath) {
      runtime.fail("参数不足", undefined, "send_video <chat_type> <chat_id> <file_path>");
    }

    const { isGroup, id } = parseChatTarget(chatType, chatId);
    const result = await runtime.sendAction(isGroup ? "send_group_msg" : "send_private_msg", {
      [isGroup ? "group_id" : "user_id"]: id,
      message: [{ type: "video", data: { file: normalizeFileArg(filePath) } }],
    });
    runtime.ok("视频发送成功", result);
  },

  async download_file(args) {
    const fileId = args[0];
    let savePath = args[1];
    if (!fileId) {
      runtime.fail("参数不足", undefined, "download_file <file_id> [save_path]");
    }

    mkdirSync(runtime.defaultDownloadDir, { recursive: true });
    if (!savePath) {
      savePath = join(runtime.defaultDownloadDir, fileId);
    }

    const result = await runtime.sendAction("get_file", { file_id: fileId });
    const fileSize = await writeDownloadedFile(result || {}, savePath);
    runtime.ok("文件下载成功", {
      file_id: fileId,
      file_path: savePath,
      file_size: fileSize,
      file_name: result?.file_name || basename(savePath),
    });
  },

  async query_messages(args) {
    const chatType = args[0];
    const chatId = args[1];
    const limit = parseInt(args[2] || "20", 10);
    if (!chatType || !chatId) {
      runtime.fail("参数不足", undefined, "query_messages <chat_type> <chat_id> [limit]");
    }

    const { isGroup, id } = parseChatTarget(chatType, chatId);
    const result = await runtime.sendAction(isGroup ? "get_group_msg_history" : "get_friend_msg_history", {
      [isGroup ? "group_id" : "user_id"]: id,
      message_seq: 0,
      count: Number.isNaN(limit) ? 20 : limit,
      reverseOrder: true,
    });

    const messages = (result?.messages || []).map((msg) => ({
      message_id: msg.message_id,
      sender_id: msg.sender?.user_id || msg.user_id,
      sender_name: msg.sender?.nickname || msg.sender?.card || msg.nickname || "未知",
      content: buildMessageContent(msg.message || []),
      timestamp: msg.time ? msg.time * 1000 : Date.now(),
      raw: msg,
    }));

    runtime.ok("查询成功", { messages, total: messages.length });
  },

  async get_group_members(args) {
    const groupId = parseInt(args[0], 10);
    if (Number.isNaN(groupId)) {
      runtime.fail("参数不足", undefined, "get_group_members <group_id>");
    }

    const result = await runtime.sendAction("get_group_member_list", { group_id: groupId });
    runtime.ok("获取群成员成功", { group_id: groupId, members: result || [] });
  },

  async delete_message(args) {
    const messageId = args[0];
    if (!messageId) {
      runtime.fail("参数不足", undefined, "delete_message <message_id>");
    }

    await runtime.sendAction("delete_msg", { message_id: messageId });
    runtime.ok("消息撤回成功", { message_id: messageId });
  },

  async get_message(args) {
    const messageId = args[0];
    if (!messageId) {
      runtime.fail("参数不足", undefined, "get_message <message_id>");
    }

    const result = await runtime.sendAction("get_msg", { message_id: messageId });
    runtime.ok("获取消息详情成功", result || {});
  },

  async set_group_ban(args) {
    const groupId = parseInt(args[0], 10);
    const userId = parseInt(args[1], 10);
    const duration = parseInt(args[2] || "0", 10);
    if (Number.isNaN(groupId) || Number.isNaN(userId)) {
      runtime.fail("参数不足", undefined, "set_group_ban <group_id> <user_id> [duration]");
    }

    await runtime.sendAction("set_group_ban", { group_id: groupId, user_id: userId, duration });
    runtime.ok("群禁言操作成功", { group_id: groupId, user_id: userId, duration });
  },

  async set_group_kick(args) {
    const groupId = parseInt(args[0], 10);
    const userId = parseInt(args[1], 10);
    const rejectAddRequest = ["true", "1", "yes"].includes(String(args[2] || "").toLowerCase());
    if (Number.isNaN(groupId) || Number.isNaN(userId)) {
      runtime.fail("参数不足", undefined, "set_group_kick <group_id> <user_id> [reject_add_request]");
    }

    await runtime.sendAction("set_group_kick", {
      group_id: groupId,
      user_id: userId,
      reject_add_request: rejectAddRequest,
    });
    runtime.ok("群踢人操作成功", { group_id: groupId, user_id: userId, reject_add_request: rejectAddRequest });
  },

  async send_group_notice(args) {
    const groupId = parseInt(args[0], 10);
    const content = args.slice(1).join(" ");
    if (Number.isNaN(groupId) || !content) {
      runtime.fail("参数不足", undefined, "send_group_notice <group_id> <content>");
    }

    const result = await runtime.sendAction("_send_group_notice", { group_id: groupId, content });
    runtime.ok("群公告发送成功", result || {});
  },

  async get_group_notice(args) {
    const groupId = parseInt(args[0], 10);
    if (Number.isNaN(groupId)) {
      runtime.fail("参数不足", undefined, "get_group_notice <group_id>");
    }

    const result = await runtime.sendAction("_get_group_notice", { group_id: groupId });
    runtime.ok("获取群公告成功", { notices: result || [], group_id: groupId });
  },

  async delete_group_notice(args) {
    const groupId = parseInt(args[0], 10);
    const noticeId = args[1];
    if (Number.isNaN(groupId) || !noticeId) {
      runtime.fail("参数不足", undefined, "delete_group_notice <group_id> <notice_id>");
    }

    const result = await runtime.sendAction("_del_group_notice", { group_id: groupId, notice_id: noticeId });
    runtime.ok("删除群公告成功", result || { group_id: groupId, notice_id: noticeId });
  },

  async set_essence(args) {
    const messageId = args[0];
    if (!messageId) {
      runtime.fail("参数不足", undefined, "set_essence <message_id>");
    }

    await runtime.sendAction("set_essence_msg", { message_id: messageId });
    runtime.ok("设为精华成功", { message_id: messageId });
  },

  async delete_essence(args) {
    const messageId = args[0];
    if (!messageId) {
      runtime.fail("参数不足", undefined, "delete_essence <message_id>");
    }

    await runtime.sendAction("delete_essence_msg", { message_id: messageId });
    runtime.ok("取消精华成功", { message_id: messageId });
  },

  async get_essence_list(args) {
    const groupId = parseInt(args[0], 10);
    if (Number.isNaN(groupId)) {
      runtime.fail("参数不足", undefined, "get_essence_list <group_id>");
    }

    const result = await runtime.sendAction("get_essence_msg_list", { group_id: groupId });
    runtime.ok("获取精华消息成功", { group_id: groupId, messages: result || [] });
  },
  };
}

const commandHandlers = createCommandHandlers();
const commandUsage = Object.keys(commandHandlers).join("|");

export async function main(argv = process.argv.slice(2), handlers = commandHandlers) {
  const command = argv[0];

  if (!command || !handlers[command]) {
    fail(
      "未知命令",
      command || "empty",
      commandUsage,
    );
  }

  try {
    await handlers[command](argv.slice(1));
  } catch (error) {
    fail("执行失败", error instanceof Error ? error.message : String(error));
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
