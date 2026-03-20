/**
 * utils.js - 通用工具函数
 */

/** 输出失败 JSON 并退出 */
export function die(msg, detail) {
  console.log(JSON.stringify({ success: false, error: msg, detail: detail ?? null }));
  process.exit(1);
}

/** 输出成功 JSON */
export function ok(data, message = '成功') {
  console.log(JSON.stringify({ success: true, message, data: data ?? null }));
}

/**
 * 解析目标聊天参数。
 * chatType: 'group' | 'direct'
 * chatId:   群号 或 'user:QQ号'
 */
export function parseTarget(chatType, chatId) {
  const isGroup = chatType === 'group';
  const rawId = chatId?.startsWith('user:') ? chatId.slice(5) : chatId;
  const numId = parseInt(rawId);
  if (isNaN(numId)) die(`无效的 chat_id: ${chatId}`);
  // group_id/user_id 对 NapCat 统一传 string
  return { isGroup, id: String(numId) };
}
