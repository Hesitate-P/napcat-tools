---
name: napcat-tools
description: NapCat QQ 主动 API 调用工具（发送消息/查询历史/获取群成员/文件操作/群管理）
metadata:
  {"openclaw":{"requires":{"bins":["node"]}}}
---

# NapCat Tools Skill

_让 Agent 能够主动调用 NapCat QQ 的 API_

---

## 技能描述

本技能提供 NapCat QQ 频道插件的主动 API 调用能力，让 Agent 可以：
- 发送 QQ 消息（私聊/群聊）
- 查询历史消息
- 获取会话列表
- 获取群成员信息
- 发送群文件
- **群管理操作**（撤回消息/禁言/踢人/群公告/精华消息）

---

## 可用工具

**调用方式**: 使用 `bash` 工具执行 `{baseDir}/scripts/napcat-tools.js` 脚本

### 1. 发送 QQ 消息

**命令**: `send_message`

```bash
node {baseDir}/scripts/napcat-tools.js send_message <chat_type> <chat_id> <message>
```

**示例**:
```bash
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js send_message group 870560083 "你好"
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js send_message direct user:123456 "私聊消息"
```

---

### 2. 查询历史消息

**命令**: `query_messages`

```bash
node {baseDir}/scripts/napcat-tools.js query_messages <chat_type> <chat_id> [limit]
```

**示例**:
```bash
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js query_messages group 870560083 20
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js query_messages direct user:123456 10
```

**返回**: `{ messages: [{ message_id, sender_id, sender_name, content, timestamp }], total }`

---

### 3. 获取会话列表

**命令**: `get_sessions`

```bash
node {baseDir}/scripts/napcat-tools.js get_sessions
```

---

### 4. 获取群成员列表

**命令**: `get_group_members`

```bash
node {baseDir}/scripts/napcat-tools.js get_group_members <group_id>
```

---

### 5. 发送文件

**命令**: `send_file`

```bash
node {baseDir}/scripts/napcat-tools.js send_file <chat_type> <chat_id> <file_path> [file_name]
```

---

### 6. 发送语音

**命令**: `send_record`

```bash
node {baseDir}/scripts/napcat-tools.js send_record <chat_type> <chat_id> <file_path>
```

---

### 7. 发送视频

**命令**: `send_video`

```bash
node {baseDir}/scripts/napcat-tools.js send_video <chat_type> <chat_id> <file_path>
```

---

### 8. 下载文件

**命令**: `download_file`

```bash
node {baseDir}/scripts/napcat-tools.js download_file <file_id> [save_path]
```

**返回**: `{ file_path, file_name, file_size }`

---

### 9. 撤回消息 ⭐ 新增

**命令**: `delete_msg`

```bash
node {baseDir}/scripts/napcat-tools.js delete_msg <message_id>
```

**示例**:
```bash
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js delete_msg 12345
```

---

### 10. 获取消息详情 ⭐ 新增

**命令**: `get_msg`

```bash
node {baseDir}/scripts/napcat-tools.js get_msg <message_id>
```

**返回**: `{ message_id, sender_id, sender_name, content, raw_message, time, message_type, group_id }`

---

### 11. 群禁言 ⭐ 新增

**命令**: `set_group_ban`

```bash
node {baseDir}/scripts/napcat-tools.js set_group_ban <group_id> <user_id> [duration_seconds]
```

- `duration_seconds`: 禁言时长（秒），默认 600。设为 `0` 解除禁言。

**示例**:
```bash
# 禁言 10 分钟
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js set_group_ban 870560083 123456 600
# 解除禁言
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js set_group_ban 870560083 123456 0
```

---

### 12. 群踢人 ⭐ 新增

**命令**: `set_group_kick`

```bash
node {baseDir}/scripts/napcat-tools.js set_group_kick <group_id> <user_id> [reject_add]
```

- `reject_add`: `true` 表示拒绝该用户再次加群，默认 `false`

**示例**:
```bash
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js set_group_kick 870560083 123456
```

---

### 13. 发送群公告 ⭐ 新增

**命令**: `send_group_notice`

```bash
node {baseDir}/scripts/napcat-tools.js send_group_notice <group_id> <content>
```

**示例**:
```bash
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js send_group_notice 870560083 "今晚 8 点开会"
```

---

### 14. 获取群公告列表 ⭐ 新增

**命令**: `get_group_notice`

```bash
node {baseDir}/scripts/napcat-tools.js get_group_notice <group_id>
```

**返回**: `{ notices: [{ notice_id, sender_id, publish_time, text }], total }`

---

### 15. 删除群公告 ⭐ 新增

**命令**: `del_group_notice`

```bash
node {baseDir}/scripts/napcat-tools.js del_group_notice <group_id> <notice_id>
```

---

### 16. 设置精华消息 ⭐ 新增

**命令**: `set_essence_msg`

```bash
node {baseDir}/scripts/napcat-tools.js set_essence_msg <message_id>
```

---

### 17. 移出精华消息 ⭐ 新增

**命令**: `delete_essence_msg`

```bash
node {baseDir}/scripts/napcat-tools.js delete_essence_msg <message_id>
```

---

### 18. 获取精华消息列表 ⭐ 新增

**命令**: `get_essence_msg_list`

```bash
node {baseDir}/scripts/napcat-tools.js get_essence_msg_list <group_id>
```

**返回**: `{ messages: [...], total }`

---

## 注意事项

1. **隐私保护**: 不要泄露用户的 QQ 号等隐私信息
2. **权限检查**: 群管理操作（禁言/踢人/公告）需要机器人有管理员权限
3. **错误处理**: 工具调用失败时要友好提示用户
4. `chat_id` 格式：私聊为 `user:QQ号`，群聊直接填群号

---

## 依赖说明

本技能依赖 NapCat QQ 频道插件（`@openclaw/napcat`）已安装并正确配置。

---

## 更新日志

### v3.0 (2026-03-19) - 新增群管理功能（2.1.11）
- ✅ `delete_msg` - 撤回消息
- ✅ `get_msg` - 获取消息详情
- ✅ `set_group_ban` - 群禁言/解禁
- ✅ `set_group_kick` - 群踢人
- ✅ `send_group_notice` - 发送群公告
- ✅ `get_group_notice` - 获取群公告列表
- ✅ `del_group_notice` - 删除群公告
- ✅ `set_essence_msg` - 设置精华消息
- ✅ `delete_essence_msg` - 移出精华消息
- ✅ `get_essence_msg_list` - 获取精华消息列表

### v2.1 (2026-03-11) - 新增查询历史消息
- ✅ `query_messages` - 查询群聊/私聊历史消息

### v2.0 (2026-03-11) - Phase 1 完成
- ✅ `send_file` / `send_record` / `send_video` / `download_file`

### v1.0 (2026-03-06) - 初始版本
- ✅ `send_message` / `get_sessions` / `get_group_members`

---

_Skill 版本：v3.0_  
_最后更新：2026-03-19_

# NapCat Tools Skill

_让 Agent 能够主动调用 NapCat QQ 的 API_

---

## 技能描述

本技能提供 NapCat QQ 频道插件的主动 API 调用能力，让 Agent 可以：
- 发送 QQ 消息（私聊/群聊）
- 查询历史消息
- 获取会话列表
- 获取群成员信息
- 发送群文件

---

## 可用工具

**调用方式**: 使用 `bash` 工具执行 `{baseDir}/scripts/napcat-tools.js` 脚本

### 1. 发送 QQ 消息

**工具名**: `napcat_send_message`

**功能**: 向指定 QQ 用户或群聊发送消息

**参数**:
- `chat_type`: "direct" | "group" - 聊天类型（私聊/群聊）
- `chat_id`: string - 聊天 ID（私聊为 `user:QQ 号`，群聊为群号）
- `message`: string - 消息内容
- `image_urls`: string[] (可选) - 图片 URL 列表

**调用命令**:
```bash
node {baseDir}/scripts/napcat-tools.js send_message <chat_type> <chat_id> <message>
```

**示例**:
```json
{
  "tool": "bash",
  "arguments": {
    "command": "node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js send_message group 870560083 \"你好，这是一条测试消息喵～\""
  }
}
```

---

### 2. 查询历史消息

**工具名**: `napcat_query_messages`

**功能**: 从 QQ 查询历史消息（支持群聊和私聊）

**参数**:
- `chat_type`: "direct" | "group" - 聊天类型（私聊/群聊）
- `chat_id`: string - 聊天 ID（私聊为 `user:QQ 号`，群聊为群号）
- `limit`: number (可选，默认 20) - 返回消息数量

**调用命令**:
```bash
node {baseDir}/scripts/napcat-tools.js query_messages <chat_type> <chat_id> [limit]
```

**示例** (群聊):
```json
{
  "tool": "bash",
  "arguments": {
    "command": "node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js query_messages group 870560083 20"
  }
}
```

**示例** (私聊):
```json
{
  "tool": "bash",
  "arguments": {
    "command": "node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js query_messages direct user:3341299096 10"
  }
}
```

**返回**:
```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "messages": [
      {
        "message_id": 12345,
        "sender_id": 3341299096,
        "sender_name": "Hesitate_P",
        "content": "测试消息",
        "timestamp": 1772789332000,
        "raw": { ... }
      },
      {
        "message_id": 12346,
        "sender_id": 3341299096,
        "sender_name": "Hesitate_P",
        "content": "[文件：test.pdf, ID:abc123_fileid]",
        "timestamp": 1772789400000,
        "raw": { ... }
      }
    ],
    "total": 2
  }
}
```

**注意**: 
- 文件消息的 content 会显示为 `[文件：文件名，ID:file_id]` 格式，可以直接提取 file_id 用于下载喵～
- 图片、语音、视频会显示为 `[图片]`、`[语音]`、`[视频]` 喵～

---

### 3. 获取会话列表

**工具名**: `napcat_get_sessions`

**功能**: 获取所有保存的会话列表

**参数**: 无

**示例**:
```json
{
  "tool": "napcat_get_sessions",
  "arguments": {}
}
```

**返回**:
```json
{
  "sessions": [
    {
      "chat_type": "group",
      "chat_id": "870560083",
      "messageCount": 15,
      "lastMessageTime": 1772789332000,
      "lastUserName": "Hesitate_P",
      "lastContent": "最后一条消息内容"
    }
  ]
}
```

---

### 4. 获取群成员列表

**工具名**: `napcat_get_group_members`

**功能**: 获取指定群聊的成员列表

**参数**:
- `group_id`: number - 群号

**示例**:
```json
{
  "tool": "napcat_get_group_members",
  "arguments": {
    "group_id": 870560083
  }
}
```

---

### 5. 发送文件（群聊/私聊）

**工具名**: `napcat_send_file`

**功能**: 向群聊或私聊发送文件

**参数**:
- `chat_type`: "direct" | "group" - 聊天类型
- `chat_id`: string - 聊天 ID（私聊为 `user:QQ 号`，群聊为群号）
- `file_path`: string - 文件路径
- `file_name`: string (可选) - 文件名

**示例** (群聊):
```json
{
  "tool": "napcat_send_file",
  "arguments": {
    "chat_type": "group",
    "chat_id": "870560083",
    "file_path": "/path/to/file.pdf",
    "file_name": "测试文件.pdf"
  }
}
```

**示例** (私聊):
```json
{
  "tool": "napcat_send_file",
  "arguments": {
    "chat_type": "direct",
    "chat_id": "user:3341299096",
    "file_path": "/path/to/file.pdf",
    "file_name": "测试文件.pdf"
  }
}
```

---

### 6. 发送语音消息

**工具名**: `napcat_send_record`

**功能**: 发送语音消息（录音）

**参数**:
- `chat_type`: "direct" | "group" - 聊天类型
- `chat_id`: string - 聊天 ID
- `file_path`: string - 语音文件路径（支持 silk/amr 格式）

**示例**:
```json
{
  "tool": "napcat_send_record",
  "arguments": {
    "chat_type": "direct",
    "chat_id": "user:3341299096",
    "file_path": "/path/to/voice.silk"
  }
}
```

---

### 7. 发送视频消息

**工具名**: `napcat_send_video`

**功能**: 发送视频消息

**参数**:
- `chat_type`: "direct" | "group" - 聊天类型
- `chat_id`: string - 聊天 ID
- `file_path`: string - 视频文件路径

**示例**:
```json
{
  "tool": "napcat_send_video",
  "arguments": {
    "chat_type": "group",
    "chat_id": "870560083",
    "file_path": "/path/to/video.mp4"
  }
}
```

---

### 8. 下载文件

**工具名**: `napcat_download_file`

**功能**: 从 NapCat 下载文件

**参数**:
- `file_id`: string - 文件 ID（从消息的 ID 字段获取，比如 `[文件：xxx, ID:yyy]` 中的 `yyy` 部分）
- `save_path`: string (可选) - 保存路径，默认为 skill 目录下的 `temp/` 文件夹

**固定下载目录**: `{skill 目录}/temp/`（即 `~/.openclaw/workspace/skills/napcat-tools/temp/`）

**示例**:
```json
{
  "tool": "napcat_download_file",
  "arguments": {
    "file_id": "982d28c7f95b09df4de35ea1c783c368_aac19ce2-1d45-11f1-9bc8-df8d9abec2e5",
    "save_path": "~/.openclaw/workspace/skills/napcat-tools/temp/test.pdf"
  }
}
```

**返回**:
```json
{
  "success": true,
  "file_path": "/home/pagurian/.openclaw/workspace/skills/napcat-tools/temp/982d28c7f95b09df4de35ea1c783c368_aac19ce2-1d45-11f1-9bc8-df8d9abec2e5",
  "file_size": 7458990
}
```

**注意**: 
- 文件下载后默认保存在 skill 目录的 `temp/` 子目录下，文件名与 file_id 相同喵～
- file_id 从消息的 ID 字段获取，比如老大发的 `[文件：56660ee1dfa7dfbe89f1000860e605b0_4748628492366077941_m.pdf, ID:982d28c7f95b09df4de35ea1c783c368_aac19ce2-1d45-11f1-9bc8-df8d9abec2e5]` 中的 `982d28c7f95b09df4de35ea1c783c368_aac19ce2-1d45-11f1-9bc8-df8d9abec2e5` 就是 file_id 喵！
- 如果要原样发回文件，直接用默认路径然后传给 `send_file` 就行喵～

---

## 使用指南

### 何时使用这些工具

**发送消息**:
- 用户明确要求发送消息
- 需要主动通知用户
- 回复群聊消息

**查询历史消息**:
- 用户询问之前的聊天内容
- 需要上下文信息
- 用户问"我之前说过什么"

**获取会话列表**:
- 用户询问有哪些聊天记录
- 需要列出所有对话

**获取群成员**:
- 用户询问群成员信息
- 需要@特定用户

**发送文件**:
- 用户要求发送文件
- 需要分享文档/图片

---

## 注意事项

1. **隐私保护**: 不要泄露用户的 QQ 号等隐私信息
2. **频率限制**: 避免短时间内发送大量消息
3. **权限检查**: 确保有权限执行操作（如发送群文件需要群成员权限）
4. **错误处理**: 工具调用失败时要友好提示用户

---

## 依赖说明

本技能依赖 NapCat QQ 频道插件（`@openclaw/napcat`）已安装并正确配置。

**前置条件**:
- NapCatQQ 已安装并运行
- OpenClaw NapCat 插件已配置（wsUrl、accessToken）
- 数据库已初始化

**文件功能额外要求**:
- 发送文件需要 NapCat 有文件访问权限
- 群文件上传需要机器人是群成员
- 语音文件需要是 silk/amr 格式（QQ 专用格式）
- 视频文件支持常见格式（mp4/avi/mkv 等）

---

## 更新日志

### v2.1 (2026-03-11) - 新增查询历史消息
- ✅ 新增 `napcat_query_messages` - 查询群聊/私聊历史消息
- ✅ 文件消息自动解析 file_id，方便下载转发
- ✅ 下载目录改为相对路径（skill 目录下的 temp/）

### v2.0 (2026-03-11) - Phase 1 完成
- ✅ 新增 `napcat_send_file` - 发送文件（群聊/私聊）
- ✅ 新增 `napcat_send_record` - 发送语音消息
- ✅ 新增 `napcat_send_video` - 发送视频消息
- ✅ 新增 `napcat_download_file` - 下载文件

### v1.0 (2026-03-06) - 初始版本
- ✅ 发送 QQ 消息
- ✅ 获取会话列表
- ✅ 获取群成员信息

---

_Skill 版本：v2.0_  
_创建日期：2026-03-06_  
_最后更新：2026-03-11_  
_作者：有鱼喵 (Catsitate)_
