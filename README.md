# napcat-tools

OpenClaw AgentSkill — 让 Agent 主动调用 NapCat QQ API。

提供发送消息、查询历史、群管理等 18 个命令，供 OpenClaw Agent 在对话中主动操作 QQ。

---

## 前置要求

| 依赖 | 说明 |
|------|------|
| [OpenClaw](https://openclaw.ai) | 主框架，需已配置 napcat-channel 插件 |
| [NapCatQQ](https://github.com/NapNeko/NapCatQQ) | 需已运行并开启 WebSocket 服务 |
| Node.js ≥ 20 | 运行时 |

---

## 安装

### 1. 克隆到 skills 目录

```bash
cd ~/.openclaw/workspace/skills
git clone <repo-url> napcat-tools
cd napcat-tools
npm install
```

### 2. 在 OpenClaw 中启用

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "skills": {
    "entries": {
      "napcat-tools": {
        "enabled": true
      }
    }
  }
}
```

### 3. 配置读取

本工具自动从 `~/.openclaw/openclaw.json` 的 `channels.napcat-channel` 读取 `wsUrl` 和 `accessToken`，无需单独配置。

---

## 使用方式

Agent 通过 `bash` 工具调用脚本：

```bash
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js <command> [args...]
```

所有命令均返回 JSON：

```json
{ "success": true, "message": "成功", "data": { ... } }
// 或
{ "success": false, "error": "错误描述", "detail": "详情" }
```

---

## 命令参考

### 消息操作

#### `send_message` — 发送文本消息

```bash
node napcat-tools.js send_message <chat_type> <chat_id> <message>
```

| 参数 | 说明 |
|------|------|
| `chat_type` | `group`（群聊）或 `direct`（私聊）|
| `chat_id` | 群号 或 `user:QQ号` |
| `message` | 消息内容 |

```bash
# 群聊
node napcat-tools.js send_message group 870560083 "你好"
# 私聊
node napcat-tools.js send_message direct user:123456 "私聊消息"
```

#### `send_file` — 发送文件

```bash
node napcat-tools.js send_file <chat_type> <chat_id> <file_path> [file_name]
```

#### `send_record` — 发送语音

```bash
node napcat-tools.js send_record <chat_type> <chat_id> <file_path>
```

支持 silk/amr 格式。

#### `send_video` — 发送视频

```bash
node napcat-tools.js send_video <chat_type> <chat_id> <file_path>
```

#### `delete_msg` — 撤回消息

```bash
node napcat-tools.js delete_msg <message_id>
```

需要机器人有撤回权限（自己的消息或管理员权限）。

---

### 消息查询

#### `query_messages` — 查询历史消息

```bash
node napcat-tools.js query_messages <chat_type> <chat_id> [limit]
```

```bash
node napcat-tools.js query_messages group 870560083 20
```

返回：`{ messages: [{ message_id, sender_id, sender_name, content, timestamp }], total }`

#### `get_msg` — 获取单条消息详情

```bash
node napcat-tools.js get_msg <message_id>
```

#### `download_file` — 下载文件

```bash
node napcat-tools.js download_file <file_id> [save_path]
```

`file_id` 从消息内容的 `[文件：xxx, ID:yyy]` 中的 `yyy` 部分获取。  
默认保存到 `scripts/../temp/` 目录。

---

### 会话管理

#### `get_sessions` — 获取会话列表

```bash
node napcat-tools.js get_sessions
```

返回所有好友和群聊列表。

#### `get_group_members` — 获取群成员

```bash
node napcat-tools.js get_group_members <group_id>
```

---

### 群管理（需要机器人为群管理员）

#### `set_group_ban` — 群禁言

```bash
node napcat-tools.js set_group_ban <group_id> <user_id> [duration_seconds]
```

`duration_seconds` 默认 600 秒，设为 `0` 解除禁言。

#### `set_group_kick` — 踢出群成员

```bash
node napcat-tools.js set_group_kick <group_id> <user_id> [reject_add]
```

`reject_add` 为 `true` 时拒绝再次加群。

#### `send_group_notice` — 发送群公告

```bash
node napcat-tools.js send_group_notice <group_id> <content>
```

#### `get_group_notice` — 获取群公告列表

```bash
node napcat-tools.js get_group_notice <group_id>
```

#### `del_group_notice` — 删除群公告

```bash
node napcat-tools.js del_group_notice <group_id> <notice_id>
```

#### `set_essence_msg` — 设置精华消息

```bash
node napcat-tools.js set_essence_msg <message_id>
```

> **注意**：NapCat 已知问题 — 权限不足时仍返回成功（retcode=0），需通过 Agent 的 `botIsGroupAdmin` 字段提前判断。

#### `delete_essence_msg` — 移出精华消息

```bash
node napcat-tools.js delete_essence_msg <message_id>
```

#### `get_essence_msg_list` — 获取精华消息列表

```bash
node napcat-tools.js get_essence_msg_list <group_id>
```

---

## 项目结构

```
napcat-tools/
├── scripts/
│   └── napcat-tools.js     # 主脚本（ESM）
├── face-map-cache.json     # QQ 表情名称本地缓存（自动生成）
├── temp/                   # 文件下载临时目录（自动创建）
├── package.json
├── SKILL.md                # OpenClaw Skill 描述文件
└── README.md
```

---

## 错误处理

| retcode | 含义 |
|---------|------|
| `1401` | 权限不足，机器人需要群管理员权限 |
| `1400` | 请求参数错误 |
| `1404` | 资源不存在（消息/群不存在，或消息 ID 有误）|
| 超时 | 30 秒无响应自动终止 |

---

## 注意事项

- **隐私保护**：不要在群聊中泄露用户 QQ 号等隐私信息
- **频率限制**：避免短时间内发送大量消息，可能触发 QQ 风控
- **chat_id 格式**：私聊为 `user:QQ号`，群聊直接填群号
- **群管理命令**需要机器人在目标群拥有管理员权限

---

_版本：3.0.0 | 协议：MIT_
