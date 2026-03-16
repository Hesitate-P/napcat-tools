---
name: napcat-tools
description: NapCat QQ 主动 API 调用工具（发送消息/查询历史/群管理/文件操作）
metadata:
  {"openclaw":{"requires":{"bins":["node"]}}}
---

# NapCat Tools Skill

让 Agent 能够主动调用 NapCat QQ API，但只在明确需要时使用。

## 适用范围

本技能负责主动命令，不负责被动接收与 Channel 适配。典型用途：

- 主动发送消息或文件
- 查询历史消息和群成员
- 下载 NapCat 文件
- 执行公告、禁言、踢人、撤回、精华等管理命令

## 调用方式

统一通过 `bash`/命令执行以下脚本：

```bash
node {baseDir}/scripts/napcat-tools.js <command> [...args]
```

## 常用命令

- `send_message <chat_type> <chat_id> <message>`
- `query_messages <chat_type> <chat_id> [limit]`
- `get_group_members <group_id>`
- `send_file <chat_type> <chat_id> <file_path> [file_name]`
- `send_record <chat_type> <chat_id> <file_path>`
- `send_video <chat_type> <chat_id> <file_path>`
- `download_file <file_id> [save_path]`

## 管理命令

- `delete_message <message_id>`
- `get_message <message_id>`
- `set_group_ban <group_id> <user_id> [duration]`
- `set_group_kick <group_id> <user_id> [reject_add_request]`
- `send_group_notice <group_id> <content>`
- `get_group_notice <group_id>`
- `delete_group_notice <group_id> <notice_id>`
- `set_essence <message_id>`
- `delete_essence <message_id>`
- `get_essence_list <group_id>`

## 高风险命令启用建议

以下命令具有明显副作用，建议在 OpenClaw 中按“可选工具”启用，并且只有在用户明确要求时才调用：

- `delete_message`
- `set_group_ban`
- `set_group_kick`
- `send_group_notice`
- `delete_group_notice`
- `set_essence`
- `delete_essence`

## 返回模型

所有命令都返回 JSON：

```json
{
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

失败时返回：

```json
{
  "success": false,
  "error": "执行失败",
  "details": "失败详情"
}
```

## 使用约束

- 不要泄露 QQ 号、群号、访问令牌等敏感信息
- 避免高频连续发送消息，降低风控风险
- 对副作用命令先确认权限、对象和上下文
- 下载文件后如需再次发送，优先显式指定路径

## 前置条件

- Node.js 20+
- NapCatQQ 已运行
- `napcat-openclaw` 已正确配置 `wsUrl` 与 `accessToken`
- OpenClaw 配置文件中可读取到 `channels.napcat`

## 说明

- 默认下载目录为技能目录下的 `temp/`
- 文件消息内容会保留 `file_id`，可直接用于 `download_file`
- 脚本已提供最小自动化测试，可用于校验命令解析、错误模型和下载处理
