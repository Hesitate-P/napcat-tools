/**
 * config.js - 配置读取
 *
 * 从 ~/.openclaw/openclaw.json 读取 napcat-channel 的连接配置。
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 读取 NapCat 连接配置。
 * 返回包含 connection.wsUrl 和 connection.accessToken 的对象。
 */
export function readConfig() {
  const configPath = join(
    process.env.HOME || process.env.USERPROFILE || '.',
    '.openclaw', 'openclaw.json',
  );
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    // 先从 channels['napcat-channel'] 读取，兜底空对象
    return raw.channels?.['napcat-channel'] ?? {};
  } catch (err) {
    // die 在 utils.js 里，这里直接输出并退出
    console.log(JSON.stringify({ success: false, error: '无法读取 OpenClaw 配置', detail: err.message }));
    process.exit(1);
  }
}
