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
2. **权限检查**: 群管理操作（禁言/踢人/公告/精华消息）需要机器人有**群管理员权限**。如果返回 `权限不足（retcode=1401）`，说明机器人不是群管理员，需要提示用户先将机器人设为管理员
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
_最后更新：2026-03-20_

