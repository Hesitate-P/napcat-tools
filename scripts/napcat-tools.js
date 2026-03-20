#!/usr/bin/env node

/**
 * napcat-tools.js - 入口脚本
 *
 * 供 OpenClaw Agent 通过 bash 调用。
 * 用法：node napcat-tools.js <command> [args...]
 *
 * 所有业务逻辑已拆分到 lib/ 目录下：
 *   lib/config.js   - 配置读取
 *   lib/utils.js    - 通用工具(die/ok/parseTarget)
 *   lib/message.js  - 消息元素解析
 *   lib/api.js      - WebSocket API 调用
 */

import { ok, die, parseTarget } from '../lib/utils.js';
import { sendAction }           from '../lib/api.js';
import { resolveMessageText }   from '../lib/message.js';

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {

    // ── 发送消息 ───────────────────────────────────────────────────────────
    case 'send_message': {
      const [chatType, chatId, ...rest] = args;
      const message = rest.join(' ');
      if (!chatType || !chatId || !message) die('用法: send_message <chat_type> <chat_id> <message>');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const result = await sendAction(isGroup ? 'send_group_msg' : 'send_private_msg', {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'text', data: { text: message } }],
      });
      ok(result, '消息发送成功');
      break;
    }

    // ── 发送文件 ───────────────────────────────────────────────────────────
    case 'send_file': {
      const [chatType, chatId, filePath, fileName] = args;
      if (!chatType || !chatId || !filePath) die('用法: send_file <chat_type> <chat_id> <file_path> [file_name]');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const name = fileName || filePath.split('/').pop();
      const result = await sendAction(isGroup ? 'send_group_msg' : 'send_private_msg', {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'file', data: { file: `file://${filePath}`, name } }],
      });
      ok(result, '文件发送成功');
      break;
    }

    // ── 发送语音 ───────────────────────────────────────────────────────────
    case 'send_record': {
      const [chatType, chatId, filePath] = args;
      if (!chatType || !chatId || !filePath) die('用法: send_record <chat_type> <chat_id> <file_path>');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const result = await sendAction(isGroup ? 'send_group_msg' : 'send_private_msg', {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'record', data: { file: filePath } }],
      });
      ok(result, '语音发送成功');
      break;
    }

    // ── 发送视频 ───────────────────────────────────────────────────────────
    case 'send_video': {
      const [chatType, chatId, filePath] = args;
      if (!chatType || !chatId || !filePath) die('用法: send_video <chat_type> <chat_id> <file_path>');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const result = await sendAction(isGroup ? 'send_group_msg' : 'send_private_msg', {
        [isGroup ? 'group_id' : 'user_id']: id,
        message: [{ type: 'video', data: { file: filePath } }],
      });
      ok(result, '视频发送成功');
      break;
    }

    // ── 下载文件 ───────────────────────────────────────────────────────────
    case 'download_file': {
      const [fileId, savePath] = args;
      if (!fileId) die('用法: download_file <file_id> [save_path]');
      const { writeFileSync, mkdirSync } = await import('fs');
      const { join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dir = dirname(fileURLToPath(import.meta.url));
      const DEFAULT_DIR = join(__dir, '..', 'temp');
      const destPath = savePath || join(DEFAULT_DIR, fileId);
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

    // ── 查询历史消息 ──────────────────────────────────────────────────────
    case 'query_messages': {
      const [chatType, chatId, limitStr] = args;
      if (!chatType || !chatId) die('用法: query_messages <chat_type> <chat_id> [limit]');
      const { isGroup, id } = parseTarget(chatType, chatId);
      const limit  = parseInt(limitStr) || 20;
      const result = await sendAction(isGroup ? 'get_group_msg_history' : 'get_friend_msg_history', {
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

    // ── 获取会话列表 ──────────────────────────────────────────────────────
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

    // ── 获取群成员 ────────────────────────────────────────────────────────
    case 'get_group_members': {
      const [groupIdStr] = args;
      if (!groupIdStr) die('用法: get_group_members <group_id>');
      const result = await sendAction('get_group_member_list', { group_id: String(groupIdStr) });
      ok({ members: result ?? [], total: (result ?? []).length });
      break;
    }

    // ── 撤回消息 ──────────────────────────────────────────────────────────
    case 'delete_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: delete_msg <message_id>');
      await sendAction('delete_msg', { message_id: String(messageId) });
      ok(null, `消息 ${messageId} 已撤回`);
      break;
    }

    // ── 获取消息详情 ──────────────────────────────────────────────────────
    case 'get_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: get_msg <message_id>');
      const result = await sendAction('get_msg', { message_id: String(messageId) });
      const content = await resolveMessageText(result?.message ?? []);
      ok({
        message_id:   result?.message_id,
        sender_id:    result?.sender?.user_id,
        sender_name:  result?.sender?.card || result?.sender?.nickname || '未知',
        content,
        raw_message:  result?.raw_message,
        time:         result?.time,
        message_type: result?.message_type,
        group_id:     result?.group_id,
      });
      break;
    }

    // ── 群禁言 ────────────────────────────────────────────────────────────
    case 'set_group_ban': {
      const [groupIdStr, userIdStr, durationStr] = args;
      if (!groupIdStr || !userIdStr) die('用法: set_group_ban <group_id> <user_id> [duration_seconds=600]');
      const duration = parseInt(durationStr ?? '600');
      await sendAction('set_group_ban', {
        group_id: String(groupIdStr),
        user_id:  String(userIdStr),
        duration,
      });
      ok(null, duration === 0 ? `用户 ${userIdStr} 已解除禁言` : `用户 ${userIdStr} 已禁言 ${duration} 秒`);
      break;
    }

    // ── 群踢人 ────────────────────────────────────────────────────────────
    case 'set_group_kick': {
      const [groupIdStr, userIdStr, rejectStr] = args;
      if (!groupIdStr || !userIdStr) die('用法: set_group_kick <group_id> <user_id> [reject_add=false]');
      await sendAction('set_group_kick', {
        group_id:           String(groupIdStr),
        user_id:            String(userIdStr),
        reject_add_request: rejectStr === 'true',
      });
      ok(null, `用户 ${userIdStr} 已被踢出群 ${groupIdStr}`);
      break;
    }

    // ── 发送群公告 ────────────────────────────────────────────────────────
    case 'send_group_notice': {
      const [groupIdStr, ...contentParts] = args;
      const content = contentParts.join(' ');
      if (!groupIdStr || !content) die('用法: send_group_notice <group_id> <content>');
      await sendAction('_send_group_notice', { group_id: String(groupIdStr), content });
      ok(null, '群公告已发送');
      break;
    }

    // ── 获取群公告 ────────────────────────────────────────────────────────
    case 'get_group_notice': {
      const [groupIdStr] = args;
      if (!groupIdStr) die('用法: get_group_notice <group_id>');
      const result = await sendAction('_get_group_notice', { group_id: String(groupIdStr) });
      const notices = (result ?? []).map((n) => ({
        notice_id:    n.notice_id,
        sender_id:    n.sender_id,
        publish_time: n.publish_time,
        text:         n.message?.text ?? n.text ?? n.content ?? '',
      }));
      ok({ notices, total: notices.length });
      break;
    }

    // ── 删除群公告 ────────────────────────────────────────────────────────
    case 'del_group_notice': {
      const [groupIdStr, noticeId] = args;
      if (!groupIdStr || !noticeId) die('用法: del_group_notice <group_id> <notice_id>');
      await sendAction('_del_group_notice', { group_id: String(groupIdStr), notice_id: noticeId });
      ok(null, `公告 ${noticeId} 已删除`);
      break;
    }

    // ── 设置精华消息 ──────────────────────────────────────────────────────
    case 'set_essence_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: set_essence_msg <message_id>');
      await sendAction('set_essence_msg', { message_id: String(messageId) });
      // NapCat 已知问题：权限不足时仍返回 retcode=0（假成功）
      ok(null, `消息 ${messageId} 已设为精华`);
      break;
    }

    // ── 移出精华消息 ──────────────────────────────────────────────────────
    case 'delete_essence_msg': {
      const [messageId] = args;
      if (!messageId) die('用法: delete_essence_msg <message_id>');
      await sendAction('delete_essence_msg', { message_id: String(messageId) });
      ok(null, `消息 ${messageId} 已移出精华`);
      break;
    }

    // ── 获取精华消息列表 ──────────────────────────────────────────────────
    case 'get_essence_msg_list': {
      const [groupIdStr] = args;
      if (!groupIdStr) die('用法: get_essence_msg_list <group_id>');
      const result = await sendAction('get_essence_msg_list', { group_id: String(groupIdStr) });
      ok({ messages: result ?? [], total: (result ?? []).length });
      break;
    }

    // ── 未知命令 ──────────────────────────────────────────────────────────
    default:
      die('未知命令', [
        'send_message', 'send_file', 'send_record', 'send_video',
        'download_file', 'query_messages', 'get_sessions', 'get_group_members',
        'delete_msg', 'get_msg',
        'set_group_ban', 'set_group_kick',
        'send_group_notice', 'get_group_notice', 'del_group_notice',
        'set_essence_msg', 'delete_essence_msg', 'get_essence_msg_list',
      ].join(' | '));
  }
}

main().catch((err) => die('执行失败', err.message));
