/**
 * api.js - WebSocket API 调用
 *
 * 每次调用建立独立 WebSocket 连接，完成后关闭，避免进程残留。
 */

import { readConfig } from './config.js';
import { die } from './utils.js';

/**
 * 向 NapCat 发送一个 OneBot API 请求并等待响应。
 *
 * @param {string} action  OneBot action 名称
 * @param {object} params  请求参数
 * @returns {Promise<any>} 响应 data 字段
 */
export async function sendAction(action, params) {
  const config      = readConfig();
  const wsUrl       = config.connection?.wsUrl       || config.wsUrl;
  const accessToken = config.connection?.accessToken || config.accessToken;

  if (!wsUrl) die('NapCat wsUrl 未配置，请检查 openclaw.json 中 channels.napcat-channel.connection.wsUrl');

  const { default: WebSocket } = await import('ws');
  const fullUrl = accessToken
    ? `${wsUrl}?access_token=${encodeURIComponent(accessToken)}`
    : wsUrl;

  return new Promise((resolve, reject) => {
    const ws      = new WebSocket(fullUrl);
    const echo    = `napcat-tools-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('请求超时 (30s)'));
    }, 30_000);

    ws.once('open', () => {
      ws.send(JSON.stringify({ action, params, echo }));
    });

    ws.on('message', (data) => {
      let resp;
      try { resp = JSON.parse(data.toString()); } catch { return; }
      if (resp.echo !== echo) return;

      clearTimeout(timeout);
      ws.close();

      if (resp.retcode === 0 || resp.status === 'ok') {
        resolve(resp.data);
      } else {
        const retcode = resp.retcode;
        let hint = resp.message || resp.wording || `retcode=${retcode}`;
        if (retcode === 1401 || String(retcode) === '1401')
          hint = `权限不足（retcode=1401）：机器人需要群管理员权限才能执行此操作`;
        else if (retcode === 1400 || String(retcode) === '1400')
          hint = `请求参数错误（retcode=1400）：${resp.message || '参数有误'}`;
        else if (retcode === 1404 || String(retcode) === '1404')
          hint = `资源不存在（retcode=1404）：消息或群不存在，或消息ID有误`;
        reject(new Error(hint));
      }
    });

    ws.once('error', (err) => { clearTimeout(timeout); ws.terminate(); reject(err); });
    ws.once('close', () => { clearTimeout(timeout); });
  });
}
