/**
 * message.js - 消息解析
 *
 * 将 OneBot/NapCat 消息元素数组解析为可读文本。
 * 与 napcat-channel 插件的 message-resolver.ts 保持逻辑一致。
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// 文件工具
// ============================================================================

export function resolveFileName(data) {
  return (data?.file_name || data?.name || data?.file || '').toString().trim()
    || (data?.file_id ? `文件_${String(data.file_id).slice(0, 8)}` : '未知文件');
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!n || isNaN(n)) return '';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024)        return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

// ============================================================================
// QQ 表情映射（本地缓存 + 网络更新）
// ============================================================================

let _faceMap = null;
const _faceMapCachePath = join(__dirname, '..', 'face-map-cache.json');

export async function loadFaceMap() {
  if (_faceMap) return _faceMap;

  // 先读本地缓存
  try {
    const raw = readFileSync(_faceMapCachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') _faceMap = parsed;
  } catch { /* 无缓存文件 */ }

  // 后台网络更新
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

async function getFaceName(id) {
  const map = _faceMap || await loadFaceMap();
  return map[String(id)] ?? `表情${id}`;
}

// ============================================================================
// 消息元素解析
// ============================================================================

export async function resolveMessageText(elements) {
  if (!Array.isArray(elements)) return '';
  const parts = [];

  for (const seg of elements) {
    const d = seg.data ?? {};
    switch (seg.type) {
      case 'text':   parts.push(d.text ?? ''); break;
      case 'at': {
        const qqId = d.qq ?? d.user_id;
        parts.push(qqId === 'all' || qqId === 'everyone' ? '@全体成员' : `@${qqId ?? ''}(${qqId ?? ''})`);
        break;
      }
      case 'face':   parts.push(`[表情：${await getFaceName(d.id ?? d.face_id ?? '0')}]`); break;
      case 'image': {
        const url = d.url || d.file;
        if (d.summary)                          parts.push(`[图片：${d.summary}]`);
        else if (url && url.startsWith('http')) parts.push(`[图片：${url}]`);
        else                                    parts.push('[图片]');
        break;
      }
      case 'file': {
        const name   = resolveFileName(d);
        const fileId = d.file_id ?? '';
        const size   = formatFileSize(d.file_size);
        const fileUrl = d.url || d.path || '';
        const meta   = [name, ...(size?[size]:[]), ...(fileId?[`ID:${fileId}`]:[]), ...(fileUrl?[`URL:${fileUrl}`]:[])];
        parts.push(`[文件：${meta.join(', ')}]`);
        break;
      }
      case 'record': {
        const rUrl = d.url || (typeof d.file==='string' && d.file.startsWith('http') ? d.file : '');
        const rSize = formatFileSize(d.file_size);
        parts.push(rUrl ? `[语音：URL:${rUrl}${rSize?' '+rSize:''}]` : '[语音]');
        break;
      }
      case 'video': {
        const vUrl = d.url || (typeof d.file==='string' && d.file.startsWith('http') ? d.file : '');
        const vSize = formatFileSize(d.file_size);
        parts.push(vUrl ? `[视频：URL:${vUrl}${vSize?' '+vSize:''}]` : '[视频]');
        break;
      }
      case 'mface':  parts.push(`[商城表情：${d.summary ?? `ID:${d.emoji_id}`}]`); break;
      case 'reply':  parts.push(`[回复消息 ID:${d.id ?? d.message_id ?? ''}]`); break;
      case 'forward': {
        if (Array.isArray(d.content) && d.content.length > 0) {
          const previews = [];
          for (const node of d.content.slice(0, 3)) {
            const nd = node.data ?? node;
            const sender = nd.name || nd.nickname || nd.sender?.nickname || '未知';
            let text = '';
            if (Array.isArray(nd.content))      text = (await resolveMessageText(nd.content)).slice(0, 50);
            else if (Array.isArray(nd.message)) text = (await resolveMessageText(nd.message)).slice(0, 50);
            else if (typeof nd.message==='string') text = nd.message.slice(0, 50);
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
      case 'dice':  parts.push(`[骰子：${d.result ?? d.value ?? '?'}点]`); break;
      case 'rps':   parts.push(`[猜拳：${d.result ?? d.value ?? '?'}]`); break;
      case 'poke': case 'shake': parts.push('[戳一戳]'); break;
      case 'music': {
        const title   = d.title || d.music_title || '';
        const singer  = d.singer || d.author || '';
        const srcType = d.type || 'qq';
        parts.push(title ? `[音乐：${title}${singer?' - '+singer:''}（${srcType}）]` : '[音乐分享]');
        break;
      }
      case 'node': {
        if (d.id) {
          parts.push(`[转发节点 ID:${d.id}]`);
        } else {
          const sender = d.name || d.nickname || '未知';
          const sub = Array.isArray(d.content)
            ? (await resolveMessageText(d.content)).slice(0, 50)
            : String(d.content ?? '').slice(0, 50);
          parts.push(`[${sender}: ${sub || '...'}]`);
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
        const addr  = d.content || d.address || '';
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
          } catch { /* */ }
        }
        parts.push(title ? `[小程序：${title}]` : '[小程序]');
        break;
      }
      case 'tts':      parts.push(d.text ? `[TTS：${d.text}]` : '[TTS 语音]'); break;
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

  return parts.join(' ').replace(/\s{2}/g, ' ').trim();
}
