#!/usr/bin/env node

/**
 * NapCat Tools - 命令行工具接口
 *
 * 供 OpenClaw Skill 调用，通过 WebSocket 与 NapCat 交互。
 * 每次调用建立独立连接，完成后关闭，避免进程残留。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// 配置读取
// ============================================================================

function readConfig() {
  const configPath = join(
    process.env.HOME || process.env.USERPROFILE || '.',
    '.openclaw', 'openclaw.json',
  );
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return raw.channels?.['napcat-channel'] || {};
  } catch (err) {
    die('无法读取 OpenClaw 配置', err.message);
  }
}

// ============================================================================
// 工具函数
// ============================================================================

function die(msg, detail) {
  console.log(JSON.stringify({ success: false, error: msg, detail }));
  process.exit(1);
}

function ok(data, message = '成功') {
  console.log(JSON.stringify({ success: true, message, data }));
}

/** 解析目标聊天 */
function parseTarget(chatType, chatId) {
  const isGroup = chatType === 'group';
  const rawId = chatId.startsWith('user:') ? chatId.slice(5) : chatId;
  const numId = parseInt(rawId);
  if (isNaN(numId)) die(`无效的 chat_id: ${chatId}`);
  // group_id/user_id 对 NapCat 统一传 string（官方文档要求）
  return { isGroup, id: String(numId) };
}

// ============================================================================
// 消息解析（与插件保持一致）
// ============================================================================

/** 解析文件名：优先 file_name/name，其次 file（私聊直接消息中为文件名） */
function resolveFileName(data) {
  return (data?.file_name || data?.name || data?.file || '').toString().trim()
    || (data?.file_id ? `文件_${String(data.file_id).slice(0, 8)}` : '未知文件');
}

/** 格式化文件大小 */
function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!n || isNaN(n)) return '';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024)        return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

/** QQ 表情映射（每次启动从网络拉取最新数据，持久化到本地文件作为离线 fallback）*/
let _faceMap = null;
const _faceMapCachePath = join(__dirname, '..', 'face-map-cache.json');

async function loadFaceMap() {
  if (_faceMap) return _faceMap;

  // 先尝试读取本地缓存（让表情在网络请求完成前就可用）
  try {
    const { readFileSync } = await import('fs');
    const raw = readFileSync(_faceMapCachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') _faceMap = parsed;
  } catch { /* 无缓存文件，忽略 */ }

  return new Promise((resolve) => {
    import('https').then(({ default: https }) => {
      https.get('https://koishi.js.org/QFace/assets/qq_emoji/_index.json', (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const map = {};
            for (const item of JSON.parse(data)) {
              if (item.emojiId && /^\d+$/.test(item.emojiId) && item.describe)
                map[item.emojiId] = item.describe.replace(/^\//, '').trim();
            }
            _faceMap = map;
            // 写入本地缓存（静默失败）
            import('fs').then(({ writeFile }) => {
              writeFile(_faceMapCachePath, JSON.stringify(map), () => {});
            }).catch(() => {});
          } catch { if (!_faceMap) _faceMap = {}; }
          resolve(_faceMap);
        });
      }).on('error', () => { resolve(_faceMap || {}); });
    }).catch(() => { resolve(_faceMap || {}); });
  });
}
// 预加载
loadFaceMap().catch(() => {});
/** QQ 表情 ID → 名称，在线加载失败时显示表情ID */
async function getFaceName(id) {
  const map = _faceMap || await loadFaceMap();
  return map[String(id)] ?? `表情${id}`;
}

/** 将消息元素数组解析为可读文本（异步，表情名称在线获取）*/
async function resolveMessageText(elements) {
  if (!Array.isArray(elements)) return '';
  const parts = [];
  for (const seg of elements) {
    const d = seg.data ?? {};
    switch (seg.type) {
      case 'text':    parts.push(d.text ?? ''); break;
      case 'at': {
        const qqId = d.qq ?? d.user_id;
        parts.push(qqId === 'all' || qqId === 'everyone' ? '@全体成员' : `@${qqId ?? ''}`);
        break;
      }
      case 'face':    parts.push(`[表情：${await getFaceName(d.id ?? d.face_id ?? '0')}]`); break;
      case 'image': {
        const url = d.url || d.file;
        if (d.summary)                                       parts.push(`[图片：${d.summary}]`);
        else if (url && url.startsWith('http'))                parts.push(`[图片：${url}]`);
        else                                                 parts.push('[图片]');
        break;
      }
      case 'file': {
        const name   = resolveFileName(d);
        const fileId = d.file_id ?? '';
        const size   = formatFileSize(d.file_size);
        const meta   = [name, ...(size ? [size] : []), ...(fileId ? [`ID:${fileId}`] : [])];
        parts.push(`[文件：${meta.join(', ')}]`);
        break;
      }
      case 'record':  parts.push('[语音]'); break;
      case 'video':   parts.push('[视频]'); break;
      case 'mface':   parts.push(`[商城表情：${d.summary ?? `ID:${d.emoji_id}`}]`); break;
      case 'reply':   parts.push(`[回复消息 ID:${d.id ?? d.message_id ?? ''}]`); break;
      case 'forward': {
        if (Array.isArray(d.content) && d.content.length > 0) {
          const previews = [];
          for (const node of d.content.slice(0, 3)) {
            const nd = node.data ?? node;
            const sender = nd.name || nd.nickname || nd.sender?.nickname || '未知';
            let text = '';
            if (Array.isArray(nd.content)) text = (await resolveMessageText(nd.content)).slice(0, 50);
            else if (Array.isArray(nd.message)) text = (await resolveMessageText(nd.message)).slice(0, 50);
            else if (typeof nd.message === 'string') text = nd.message.slice(0, 50);
            previews.push(`${sender}: ${text || '...'}`);
          }
          const more = d.content.length > 3 ? `（共${d.content.length}条）` : '';
          parts.push(`[转发消息${more}\n${previews.join('\n')}]`);
        } else if (d.id) {
          parts.push(`[转发消息 ID:${d.id}]`);
        } else {
          parts.push('[转发消息]');
        }
        break;
      }
      case 'json': {
        let title = '';
        const raw = d.data || d.content || '';
        if (raw) {
          try {
            const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
            title = obj?.meta?.detail_1?.title || obj?.meta?.news?.title
                  || obj?.meta?.music?.title   || obj?.meta?.video?.title
                  || obj?.prompt || obj?.app || '';
          } catch { /* */ }
        }
        parts.push(title ? `[卡片：${title}]` : d.prompt ? `[卡片：${d.prompt}]` : '[JSON 卡片]');
        break;
      }
      case 'xml': {
        const rawXml = String(d.data || d.content || '');
        const m = rawXml.match(/title="([^"]*)"/i) || rawXml.match(/summary="([^"]*)"/i)
               || rawXml.match(/<name>([^<]*)<\/name>/i);
        parts.push(m?.[1] ? `[XML 卡片：${m[1]}]` : '[XML 卡片]');
        break;
      }
      case 'dice':    parts.push(`[骰子：${d.result ?? d.value ?? '?'}点]`); break;
      case 'rps':     parts.push(`[猜拳：${d.result ?? d.value ?? '?'}]`); break;
      case 'poke': case 'shake': parts.push('[戳一戳]'); break;
      case 'music': {
        const title = d.title || d.music_title || '';
        const singer = d.singer || d.author || '';
        const srcType = d.type || 'qq';
        parts.push(title ? `[音乐：${title}${singer ? ' - ' + singer : ''}（${srcType}）]` : '[音乐分享]');
        break;
      }
      case 'node': {
        if (d.id) { parts.push(`[转发节点 ID:${d.id}]`); }
        else {
          const senderName = d.name || d.nickname || '未知';
          const sub = Array.isArray(d.content) ? (await resolveMessageText(d.content)).slice(0, 50) : String(d.content ?? '').slice(0, 50);
          parts.push(`[${senderName}: ${sub || '...'}]`);
        }
        break;
      }
      case 'contact': {
        const ct = d.type === 'group' ? '群聊' : '好友';
        parts.push(`[${ct}名片 ID:${d.id ?? ''}]`);
        break;
      }
      case 'location': {
        const title = d.title || '';
        const addr = d.content || d.address || '';
        const lat = d.lat ?? ''; const lon = d.lon ?? '';
        const desc = [title, addr].filter(Boolean).join('，');
        parts.push(`[位置：${desc || `(${lat},${lon})`}]`);
        break;
      }
      case 'share': {
        const title = d.title || ''; const url = d.url || '';
        parts.push(title && url ? `[分享：${title} ${url}]` : url ? `[分享：${url}]` : '[链接分享]');
        break;
      }
      case 'miniapp': {
        let title = d.title || d.app_name || '';
        if (!title && d.data) {
          try {
            const inner = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
            title = inner?.meta?.detail_1?.title || inner?.meta?.news?.title || inner?.prompt || '';
          } catch { /* ignore */ }
        }
        parts.push(title ? `[小程序：${title}]` : '[小程序]');
        break;
      }
      case 'tts': parts.push(d.text ? `[TTS：${d.text}]` : '[TTS 语音]'); break;
      case 'markdown': {
        const raw = String(d.content || d.data || '');
        const plain = raw.replace(/#{1,6}\s*/g, '').replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`[^`]*`/g, '').replace(/\n+/g, ' ').trim();
        parts.push(plain ? `[Markdown：${plain.slice(0, 100)}]` : '[Markdown]');
        break;
      }
      default: break;
    }
  }
  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

// ============================================================================
// WebSocket API 调用
// ============================================================================

async function sendAction(action, params) {
  const config       = readConfig();
  const wsUrl        = config.connection?.wsUrl || config.wsUrl;
  const accessToken  = config.connection?.accessToken || config.accessToken;

  if (!wsUrl) die('NapCat wsUrl 未配置');

  const { default: WebSocket } = await import('ws');
  const fullUrl = accessToken ? `${wsUrl}?access_token=${encodeURIComponent(accessToken)}` : wsUrl;

  return new Promise((resolve, reject) => {
    const ws      = new WebSocket(fullUrl);
    const echo    = `napcat-tools-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => { ws.terminate(); reject(new Error('请求超时 (30s)')); }, 30_000);

    ws.once('open', () => {
      ws.send(JSON.stringify({ action, params, echo }));
    });

    ws.on('message', (data) => {
      let resp;
      try { resp = JSON.parse(data.toString()); } catch { return; }
      if (resp.echo !== echo) return;
      clearTimeout(timeout);
      ws.close();
      if (resp.retcode === 0 || resp.status === 'ok') resolve(resp.data);
      else {
        const retcode = resp.retcode;
        let hint = resp.message || resp.wording || `retcode=${retcode}`;
        if (retcode === 1401 || String(retcode) === '1401') hint = `权限不足（retcode=1401）：机器人需要群管理员权限才能执行此操作`;
        else if (retcode === 1400 || String(retcode) === '1400') hint = `请求参数错误（retcode=1400）：${resp.message || '参数有误'}`;
        else if (retcode === 1404 || String(retcode) === '1404') hint = `资源不存在（retcode=1404）：消息或群不存在，或消息ID有误`;
        reject(new Error(hint));
      }
    });

    ws.once('error', (err) => { clearTimeout(timeout); reject(err); });
    ws.once('close', () => clearTimeout(timeout));
  });
}

// ============================================================================
// 命令处理
// ============================================================================

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {

    // ── 发送消息 ─────────────────────────────────────────────────────────────
    case 'send_message': {
      const [chatType, chatId, ...rest] = args;
      const message = rest.join(' ');
      if (!chatType || !chatId || !message) die('用法: send_message <chat_type> <chat_id> <message>');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const action = isGroup ? 'send_group_msg' : 'send_private_msg';
      const result = await sendAction(action, {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'text', data: { text: message } }],
      });
      ok(result, '消息发送成功');
      break;
    }

    // ── 发送文件 ─────────────────────────────────────────────────────────────
    case 'send_file': {
      const [chatType, chatId, filePath, fileName] = args;
      if (!chatType || !chatId || !filePath) die('用法: send_file <chat_type> <chat_id> <file_path> [file_name]');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const name   = fileName || filePath.split('/').pop();
      const action = isGroup ? 'send_group_msg' : 'send_private_msg';
      const result = await sendAction(action, {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'file', data: { file: `file://${filePath}`, name } }],
      });
      ok(result, '文件发送成功');
      break;
    }

    // ── 发送语音 ─────────────────────────────────────────────────────────────
    case 'send_record': {
      const [chatType, chatId, filePath] = args;
      if (!chatType || !chatId || !filePath) die('用法: send_record <chat_type> <chat_id> <file_path>');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const action = isGroup ? 'send_group_msg' : 'send_private_msg';
      const result = await sendAction(action, {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'record', data: { file: filePath } }],
      });
      ok(result, '语音发送成功');
      break;
    }

    // ── 发送视频 ─────────────────────────────────────────────────────────────
    case 'send_video': {
      const [chatType, chatId, filePath] = args;
      if (!chatType || !chatId || !filePath) die('用法: send_video <chat_type> <chat_id> <file_path>');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const action = isGroup ? 'send_group_msg' : 'send_private_msg';
      const result = await sendAction(action, {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'video', data: { file: filePath } }],
      });
      ok(result, '视频发送成功');
      break;
    }

    // ── 下载文件 ─────────────────────────────────────────────────────────────
    case 'download_file': {
      const [fileId, savePath] = args;
      if (!fileId) die('用法: download_file <file_id> [save_path]');

      const DEFAULT_DIR = join(__dirname, '..', 'temp');
      const destPath    = savePath || join(DEFAULT_DIR, fileId);

      const result = await sendAction('get_file', { file_id: fileId });

      if (result?.base64) {
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, Buffer.from(result.base64, 'base64'));
        ok({ file_path: destPath, file_name: result.file_name, file_size: result.file_size }, '文件下载成功');
      } else if (result?.file) {
        ok({ file_path: result.file, file_name: result.file_name, file_size: result.file_size }, '文件已在 NapCat 本地');
      } else {
        ok(result, '未获取到文件内容');
      }
      break;
    }

    // ── 查询历史消息 ──────────────────────────────────────────────────────────
    case 'query_messages': {
      const [chatType, chatId, limitStr] = args;
      if (!chatType || !chatId) die('用法: query_messages <chat_type> <chat_id> [limit]');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const limit  = parseInt(limitStr) || 20;
      const action = isGroup ? 'get_group_msg_history' : 'get_friend_msg_history';
      const result = await sendAction(action, {
        [isGroup ? 'group_id' : 'user_id']: id,
        count: limit,
      });

      const messages = await Promise.all((result?.messages ?? []).map(async (msg) => ({
        message_id:  msg.message_id,
        sender_id:   msg.sender?.user_id || msg.user_id,
        sender_name: msg.sender?.card || msg.sender?.nickname || '未知',
        content:     await resolveMessageText(msg.message ?? []),
        timestamp:   msg.time ? msg.time * 1000 : Date.now(),
      })));

      ok({ messages, total: messages.length }, '查询成功');
      break;
    }

    // ── 获取会话列表 ──────────────────────────────────────────────────────────
    case 'get_sessions': {
      const [friendsResult, groupsResult] = await Promise.all([
        sendAction('get_friend_list', {}),
        sendAction('get_group_list',  {}),
      ]);
      const friends = (friendsResult ?? []).map((f) => ({
        type: 'direct', id: `user:${f.user_id}`,
        name: f.remark || f.nickname || String(f.user_id), user_id: f.user_id,
      }));
      const groups = (groupsResult ?? []).map((g) => ({
        type: 'group', id: String(g.group_id),
        name: g.group_name || String(g.group_id), group_id: g.group_id, member_count: g.member_count,
      }));
      ok({ friends, groups, total: friends.length + groups.length });
      break;
    }

    // ── 获取群成员 ────────────────────────────────────────────────────────────
    case 'get_group_members': {
      const [groupIdStr] = args;
      if (!groupIdStr) die('用法: get_group_members <group_id>');
      const result = await sendAction('get_group_member_list', { group_id: String(groupIdStr) });
      ok({ members: result ?? [], total: (result ?? []).length });
      break;
    }

    // ── 撤回消息 ─────────────────────────────────────────────────────────────
    case 'delete_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: delete_msg <message_id>');
      await sendAction('delete_msg', { message_id: String(messageId) });
      ok(null, `消息 ${messageId} 已撤回`);
      break;
    }

    // ── 获取消息详情 ──────────────────────────────────────────────────────────
    case 'get_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: get_msg <message_id>');
      const result = await sendAction('get_msg', { message_id: String(messageId) });
      const content = await resolveMessageText(result?.message ?? []);
      ok({
        message_id:  result?.message_id,
        sender_id:   result?.sender?.user_id,
        sender_name: result?.sender?.card || result?.sender?.nickname || '未知',
        content,
        raw_message: result?.raw_message,
        time:        result?.time,
        message_type: result?.message_type,
        group_id:    result?.group_id,
      });
      break;
    }

    // ── 群禁言 ───────────────────────────────────────────────────────────────
    case 'set_group_ban': {
      const [groupIdStr, userIdStr, durationStr] = args;
      if (!groupIdStr || !userIdStr) die('用法: set_group_ban <group_id> <user_id> [duration_seconds=600]');
      const duration = parseInt(durationStr ?? '600');
      await sendAction('set_group_ban', {
        group_id: String(groupIdStr),   // API 要求 string
        user_id:  String(userIdStr),    // API 要求 string
        duration,
      });
      ok(null, duration === 0 ? `用户 ${userIdStr} 已解除禁言` : `用户 ${userIdStr} 已禁言 ${duration} 秒`);
      break;
    }

    // ── 群踢人 ───────────────────────────────────────────────────────────────
    case 'set_group_kick': {
      const [groupIdStr, userIdStr, rejectStr] = args;
      if (!groupIdStr || !userIdStr) die('用法: set_group_kick <group_id> <user_id> [reject_add=false]');
      const rejectAdd = rejectStr === 'true';
      await sendAction('set_group_kick', {
        group_id:           String(groupIdStr),   // API 要求 string
        user_id:            String(userIdStr),    // API 要求 string
        reject_add_request: rejectAdd,
      });
      ok(null, `用户 ${userIdStr} 已被踢出群 ${groupIdStr}`);
      break;
    }

    // ── 发送群公告 ───────────────────────────────────────────────────────────
    case 'send_group_notice': {
      const [groupIdStr, ...contentParts] = args;
      const content = contentParts.join(' ');
      if (!groupIdStr || !content) die('用法: send_group_notice <group_id> <content>');
      await sendAction('_send_group_notice', {
        group_id: String(groupIdStr),
        content,
      });
      ok(null, '群公告已发送');
      break;
    }

    // ── 获取群公告 ───────────────────────────────────────────────────────────
    case 'get_group_notice': {
      const [groupIdStr] = args;
      if (!groupIdStr) die('用法: get_group_notice <group_id>');
      const result = await sendAction('_get_group_notice', { group_id: String(groupIdStr) });
      const notices = (result ?? []).map((n) => ({
        notice_id:    n.notice_id,
        sender_id:    n.sender_id,
        publish_time: n.publish_time,
        // NapCat 返回 message.text，兼容直接 text 字段
        text:         n.message?.text ?? n.text ?? n.content ?? '',
      }));
      ok({ notices, total: notices.length });
      break;
    }

    // ── 删除群公告 ───────────────────────────────────────────────────────────
    case 'del_group_notice': {
      const [groupIdStr, noticeId] = args;
      if (!groupIdStr || !noticeId) die('用法: del_group_notice <group_id> <notice_id>');
      await sendAction('_del_group_notice', {
        group_id:  String(groupIdStr),
        notice_id: noticeId,
      });
      ok(null, `公告 ${noticeId} 已删除`);
      break;
    }

    // ── 设置精华消息 ─────────────────────────────────────────────────────────
    case 'set_essence_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: set_essence_msg <message_id>');
      await sendAction('set_essence_msg', { message_id: String(messageId) });
      // 注意：NapCat 已知 bug — 权限不足时仍返回 retcode=0（假成功），等待上游修复
      // 管理员状态已在插件 BodyForAgent 的 qq_context 中提供，Agent 可据此判断
      ok(null, `消息 ${messageId} 已设为精华`);
      break;
    }

    // ── 移出精华消息 ─────────────────────────────────────────────────────────
    case 'delete_essence_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: delete_essence_msg <message_id>');
      await sendAction('delete_essence_msg', { message_id: String(messageId) });
      ok(null, `消息 ${messageId} 已移出精华`);
      break;
    }

    // ── 获取群精华消息列表 ────────────────────────────────────────────────────
    case 'get_essence_msg_list': {
      const [groupIdStr] = args;
      if (!groupIdStr) die('用法: get_essence_msg_list <group_id>');
      const result = await sendAction('get_essence_msg_list', { group_id: String(groupIdStr) });
      ok({ messages: result ?? [], total: (result ?? []).length });
      break;
    }

    default:
      die('未知命令', `可用命令: send_message | send_file | send_record | send_video | download_file | query_messages | get_sessions | get_group_members | delete_msg | get_msg | set_group_ban | set_group_kick | send_group_notice | get_group_notice | del_group_notice | set_essence_msg | delete_essence_msg | get_essence_msg_list`);
  }
}

main().catch((err) => die('执行失败', err.message));
