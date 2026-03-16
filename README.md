# NapCat Tools

`napcat-tools` 是给 OpenClaw / Agent Skill 使用的 NapCat 主动 API 工具层，职责是通过 CLI 调用 NapCat 接口，并稳定输出 JSON 结果。

## 仓库定位

- 只负责主动工具调用，不复制 `napcat-openclaw` 内部适配实现
- 所有命令统一输出 `{ success, message, data, error }` 风格 JSON
- 适合作为可选工具启用，尤其是高副作用管理命令

## 支持命令

- 消息发送：`send_message`
- 文件发送：`send_file`
- 语音发送：`send_record`
- 视频发送：`send_video`
- 文件下载：`download_file`
- 历史查询：`query_messages`
- 群成员：`get_group_members`
- 基础管理：`delete_message`、`get_message`
- 群管理：`set_group_ban`、`set_group_kick`
- 公告管理：`send_group_notice`、`get_group_notice`、`delete_group_notice`
- 精华管理：`set_essence`、`delete_essence`、`get_essence_list`

## 高风险命令

以下命令会直接产生管理副作用，建议在 OpenClaw 中作为可选工具按需启用，而不是默认开放：

- `delete_message`
- `set_group_ban`
- `set_group_kick`
- `send_group_notice`
- `delete_group_notice`
- `set_essence`
- `delete_essence`

## 环境要求

- Node.js 20+
- 已配置好的 OpenClaw `openclaw.json`
- 可连接的 NapCat WebSocket

## 安装与使用

```bash
npm install
node scripts/napcat-tools.js send_message group 870560083 "你好"
```

## 开发命令

```bash
npm run typecheck
npm run test
npm run build
npm run ci
```

说明：

- `typecheck` 当前使用 `node --check` 做脚本语法校验
- `test` 使用 `node:test` 验证命令解析、错误模型和下载处理
- `build` 为占位脚本，表示该仓库无需额外构建产物

## 输出示例

```json
{
  "success": true,
  "message": "消息发送成功",
  "data": {
    "message_id": 123456
  }
}
```

```json
{
  "success": false,
  "error": "执行失败",
  "details": "请求超时: send_group_msg"
}
```

## 与 `napcat-openclaw` 的关系

- `napcat-openclaw` 负责被动接收消息和 Channel 适配
- `napcat-tools` 负责主动调用管理/文件/查询接口
- 两边通过命令面、JSON 结果结构和文档约定保持一致

## 许可证

MIT
