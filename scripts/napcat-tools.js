#!/usr/bin/env node

/**
 * NapCat Tools - 命令行工具接口
 * 
 * 供 OpenClaw Skill 调用的命令行工具
 * 支持：发送文件、发送语音、发送视频、下载文件
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 读取配置
function readConfig() {
  const configPath = join(process.env.HOME || process.env.USERPROFILE || '.', '.openclaw', 'openclaw.json');
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config.channels?.napcat || {};
  } catch (error) {
    console.error(JSON.stringify({ error: '无法读取 OpenClaw 配置', details: error.message }));
    process.exit(1);
  }
}

// 消息去重：记录最近发送的消息 ID
const SENT_MESSAGES = new Map();
const DEDUP_WINDOW_MS = 5000; // 5 秒内去重

function checkDuplicate(action, params) {
  const key = `${action}:${JSON.stringify(params)}`;
  const now = Date.now();
  
  // 清理过期的记录
  for (const [k, timestamp] of SENT_MESSAGES.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      SENT_MESSAGES.delete(k);
    }
  }
  
  // 检查是否重复
  if (SENT_MESSAGES.has(key)) {
    return true;
  }
  
  SENT_MESSAGES.set(key, now);
  return false;
}

// 发送 WebSocket 请求
async function sendAction(action, params) {
  const config = readConfig();
  // 兼容新旧配置结构：新配置在 connection 对象里，旧配置直接在根级别
  const wsUrl = config.connection?.wsUrl || config.wsUrl;
  const accessToken = config.connection?.accessToken || config.accessToken;
  
  if (!wsUrl) {
    console.error(JSON.stringify({ error: 'NapCat wsUrl 未配置' }));
    process.exit(1);
  }
  
  // 检查重复发送
  if (checkDuplicate(action, params)) {
    console.error(JSON.stringify({ step: '检测到重复请求，已跳过', action, params }));
    return { skipped: true, reason: 'duplicate' };
  }
  
  // 使用 WebSocket 发送请求
  const WebSocket = (await import('ws')).default;
  
  return new Promise((resolve, reject) => {
    // NapCat 认证方式：access_token 查询参数
    const fullUrl = accessToken ? `${wsUrl}?access_token=${encodeURIComponent(accessToken)}` : wsUrl;
    console.error(JSON.stringify({ step: '连接 WebSocket', url: fullUrl.replace(accessToken, '***') }));
    const ws = new WebSocket(fullUrl);
    
    ws.on('open', () => {
      const echo = `napcat-tools-${Date.now()}`;
      const request = {
        action,
        params,
        echo,
      };
      
      console.error(JSON.stringify({ step: '发送请求', action, params }));
      ws.send(JSON.stringify(request));
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('请求超时'));
      }, 30000);
      
      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          console.error(JSON.stringify({ step: '收到响应', response }));
          
          // 检查是否是这个请求的响应（通过 echo 匹配）
          if (response.echo !== echo) {
            console.error(JSON.stringify({ step: 'echo 不匹配', expected: echo, got: response.echo }));
            return;  // 不是这个请求的响应，忽略
          }
          
          clearTimeout(timeout);
          if (response.retcode === 0 || response.status === 'ok') {
            resolve(response.data);
            ws.close();
          } else {
            reject(new Error(response.message || JSON.stringify(response)));
            ws.close();
          }
        } catch (error) {
          console.error(JSON.stringify({ step: '解析错误', data: data.toString() }));
          reject(error);
          ws.close();
        }
      };
      
      ws.on('message', messageHandler);
    });
    
    ws.on('error', (error) => {
      reject(error);
    });
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    let result;
    
    switch (command) {
      case 'send_message': {
        // napcat-tools.js send_message <chat_type> <chat_id> <message>
        const chatType = args[1];
        const chatId = args[2];
        const message = args.slice(3).join(' ');
        
        if (!chatType || !chatId || !message) {
          console.error(JSON.stringify({ error: '参数不足', usage: 'send_message <chat_type> <chat_id> <message>' }));
          process.exit(1);
        }
        
        const isGroup = chatType === 'group';
        const id = chatId.startsWith('user:') ? parseInt(chatId.slice(5)) : parseInt(chatId);
        
        const action = isGroup ? 'send_group_msg' : 'send_private_msg';
        result = await sendAction(action, {
          [isGroup ? 'group_id' : 'user_id']: id,
          message: [{ type: 'text', data: { text: message } }],
        });
        
        console.log(JSON.stringify({ success: true, message: '消息发送成功', data: result }));
        break;
      }
      
      case 'send_file': {
        // napcat-tools.js send_file <chat_type> <chat_id> <file_path> [file_name]
        const chatType = args[1];
        const chatId = args[2];
        const filePath = args[3];
        const fileName = args[4] || filePath.split('/').pop();
        
        if (!chatType || !chatId || !filePath) {
          console.error(JSON.stringify({ error: '参数不足', usage: 'send_file <chat_type> <chat_id> <file_path> [file_name]' }));
          process.exit(1);
        }
        
        const isGroup = chatType === 'group';
        const id = chatId.startsWith('user:') ? parseInt(chatId.slice(5)) : parseInt(chatId);
        
        // 使用 send_msg + file 元素发送文件（更通用的方式）
        const action = isGroup ? 'send_group_msg' : 'send_private_msg';
        result = await sendAction(action, {
          [isGroup ? 'group_id' : 'user_id']: id,
          message: [{ type: 'file', data: { file: `file://${filePath}`, name: fileName } }],
        });
        
        console.log(JSON.stringify({ success: true, message: '文件发送成功', data: result }));
        break;
      }
      
      case 'send_record': {
        // napcat-tools.js send_record <chat_type> <chat_id> <file_path>
        const chatType = args[1];
        const chatId = args[2];
        const filePath = args[3];
        
        if (!chatType || !chatId || !filePath) {
          console.error(JSON.stringify({ error: '参数不足', usage: 'send_record <chat_type> <chat_id> <file_path>' }));
          process.exit(1);
        }
        
        const isGroup = chatType === 'group';
        const id = chatId.startsWith('user:') ? parseInt(chatId.slice(5)) : parseInt(chatId);
        
        const action = isGroup ? 'send_group_msg' : 'send_private_msg';
        result = await sendAction(action, {
          [isGroup ? 'group_id' : 'user_id']: id,
          message: [{ type: 'record', data: { file: filePath } }],
        });
        
        console.log(JSON.stringify({ success: true, message: '语音发送成功', data: result }));
        break;
      }
      
      case 'send_video': {
        // napcat-tools.js send_video <chat_type> <chat_id> <file_path>
        const chatType = args[1];
        const chatId = args[2];
        const filePath = args[3];
        
        if (!chatType || !chatId || !filePath) {
          console.error(JSON.stringify({ error: '参数不足', usage: 'send_video <chat_type> <chat_id> <file_path>' }));
          process.exit(1);
        }
        
        const isGroup = chatType === 'group';
        const id = chatId.startsWith('user:') ? parseInt(chatId.slice(5)) : parseInt(chatId);
        
        const action = isGroup ? 'send_group_msg' : 'send_private_msg';
        result = await sendAction(action, {
          [isGroup ? 'group_id' : 'user_id']: id,
          message: [{ type: 'video', data: { file: filePath } }],
        });
        
        console.log(JSON.stringify({ success: true, message: '视频发送成功', data: result }));
        break;
      }
      
      case 'download_file': {
        // napcat-tools.js download_file <file_id> [save_path]
        const fileId = args[1];
        let savePath = args[2];
        
        // 固定下载目录：相对于 skill 脚本所在目录的 ./temp 文件夹
        const DEFAULT_DOWNLOAD_DIR = join(__dirname, '..', 'temp') + '/';
        
        if (!fileId) {
          console.error(JSON.stringify({ error: '参数不足', usage: 'download_file <file_id> [save_path]' }));
          process.exit(1);
        }
        
        // 如果没有指定保存路径，使用默认目录
        if (!savePath) {
          savePath = DEFAULT_DOWNLOAD_DIR + fileId;
        }
        
        result = await sendAction('get_file', { file_id: fileId });
        
        // 保存文件
        if (result.data) {
          writeFileSync(savePath, result.data);
          result.save_path = savePath;
          console.log(JSON.stringify({ success: true, message: '文件下载成功', data: { file_path: savePath } }));
        } else {
          console.log(JSON.stringify({ success: true, message: '文件下载成功（数据已在 NapCat 目录）', data: { file_path: DEFAULT_DOWNLOAD_DIR + fileId } }));
        }
        
        break;
      }
      
      case 'query_messages': {
        // napcat-tools.js query_messages <chat_type> <chat_id> [limit]
        const chatType = args[1];
        const chatId = args[2];
        const limit = parseInt(args[3]) || 20;
        
        if (!chatType || !chatId) {
          console.error(JSON.stringify({ error: '参数不足', usage: 'query_messages <chat_type> <chat_id> [limit]' }));
          process.exit(1);
        }
        
        const isGroup = chatType === 'group';
        const id = chatId.startsWith('user:') ? parseInt(chatId.slice(5)) : parseInt(chatId);
        
        // 使用 get_group_msg_history 或 get_friend_msg_history 查询历史消息
        const action = isGroup ? 'get_group_msg_history' : 'get_friend_msg_history';
        result = await sendAction(action, {
          [isGroup ? 'group_id' : 'user_id']: id,
          message_seq: 0,  // 0 表示最新消息
          count: limit,
          reverseOrder: true,  // 倒序，最新的在前
        });
        
        // 格式化返回结果 - 使用通用消息解析函数
        const messages = await Promise.all((result.messages || []).map(async (msg) => {
          // 复用消息解析逻辑
          let content = '';
          try {
            for (const m of (msg.message || [])) {
              if (m.type === 'text') content += m.data?.text || '';
              else if (m.type === 'at') {
                const qqId = m.data?.qq ?? m.data?.user_id;
                if (qqId === 'all' || qqId === 'everyone') content += ' @全体成员 ';
                else content += ` @${qqId || ''} `;
              }
              else if (m.type === 'face') {
                const faceId = String(m.data?.id ?? m.data?.face_id ?? '0');
                content += ` [表情:${faceId}] `;
              }
              else if (m.type === 'image') {
                const url = m.data?.url || m.data?.file;
                const summary = m.data?.summary;
                if (summary) content += ` [图片：${summary}] `;
                else if (url && (url.startsWith('http') || url.startsWith('base64://'))) content += ` [图片：${url}] `;
                else content += ' [图片] ';
              }
              else if (m.type === 'file') {
                const name = m.data?.name || 'unknown';
                const fileId = m.data?.file_id || m.file_id || 'unknown';
                content += `[文件：${name}, ID:${fileId}]`;
              }
              else if (m.type === 'record') content += ' [语音] ';
              else if (m.type === 'video') content += ' [视频] ';
              else if (m.type === 'mface') content += ` [商城表情：${m.data?.summary || `ID:${m.data?.emoji_id}`}] `;
              else if (m.type === 'forward') content += ' [转发消息] ';
              else if (m.type === 'xml' || m.type === 'json') content += ' [卡片消息] ';
            }
          } catch (e) {
            content = (msg.message || []).map(m => {
              if (m.type === 'text') return m.data?.text || '';
              if (m.type === 'file') return `[文件：${m.data?.name || 'unknown'}]`;
              return `[${m.type}]`;
            }).join('');
          }
          
          return {
            message_id: msg.message_id,
            sender_id: msg.sender?.user_id || msg.user_id,
            sender_name: msg.sender?.nickname || msg.sender?.card || msg.nickname || '未知',
            content: content.trim(),
            timestamp: msg.time ? msg.time * 1000 : Date.now(),
            raw: msg,
          };
        }));
        
        console.log(JSON.stringify({ success: true, message: '查询成功', data: { messages, total: messages.length } }));
        break;
      }
      
      default:
        console.error(JSON.stringify({ error: '未知命令', usage: 'napcat-tools.js <send_file|send_record|send_video|download_file> [args...]' }));
        process.exit(1);
    }
  } catch (error) {
    console.error(JSON.stringify({ error: '执行失败', details: error.message }));
    process.exit(1);
  }
}

main();
