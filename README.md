# napcat-tools

OpenClaw AgentSkill — 让 Agent 主动调用 NapCat QQ API。

配套插件：[napcat-openclaw](https://github.com/Hesitate-P/napcat-openclaw)

## 功能

| 命令 | 说明 |
|------|------|
| `send_message` | 发送文本消息（私聊/群聊） |
| `query_messages` | 查询历史消息 |
| `get_sessions` | 获取会话列表 |
| `get_group_members` | 获取群成员列表 |
| `send_file` | 发送文件 |
| `send_record` | 发送语音消息 |
| `send_video` | 发送视频消息 |
| `download_file` | 下载文件（保存至 `temp/`） |
| `delete_msg` | 撤回消息 |
| `get_msg` | 获取消息详情 |
| `set_group_ban` | 群禁言/解禁（duration=0 解禁） |
| `set_group_kick` | 群踢人 |
| `send_group_notice` | 发送群公告 |
| `get_group_notice` | 获取群公告列表 |
| `del_group_notice` | 删除群公告 |
| `set_essence_msg` | 设置精华消息 |
| `delete_essence_msg` | 移出精华消息 |
| `get_essence_msg_list` | 获取精华消息列表 |

## 安装

```bash
# 通过 ClawHub 安装
clawhub install napcat-tools

# 或手动安装
git clone https://github.com/Hesitate-P/napcat-tools.git \
  ~/.openclaw/workspace/skills/napcat-tools
```

## 使用

所有命令通过 `bash` 工具执行脚本：

```bash
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js <command> [<args...>]
```

### 示例

```bash
# 发送群消息
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js \
  send_message group 870560083 "你好喵～"

# 查询最近 20 条群消息
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js \
  query_messages group 870560083 20

# 禁言用户 10 分钟
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js \
  set_group_ban 870560083 123456 600

# 解除禁言
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js \
  set_group_ban 870560083 123456 0

# 下载文件
node ~/.openclaw/workspace/skills/napcat-tools/scripts/napcat-tools.js \
  download_file <file_id>
```

### chat_id 格式

- 群聊：直接填群号，如 `870560083`
- 私聊：`user:QQ号`，如 `user:3341299096`

## 依赖

- NapCatQQ 已安装并运行
- [napcat-openclaw](https://github.com/Hesitate-P/napcat-openclaw) 插件已配置（wsUrl、accessToken）
- Node.js 18+

## 注意事项

- 群管理操作（禁言/踢人/公告）需要机器人拥有群管理员权限
- 文件默认下载至 `skills/napcat-tools/temp/` 目录
- 语音文件建议使用 silk/amr 格式

## 更新日志

### v3.0 (2026-03-19)
- 新增群管理命令：`delete_msg`、`get_msg`、`set_group_ban`、`set_group_kick`
- 新增群公告命令：`send_group_notice`、`get_group_notice`、`del_group_notice`
- 新增精华消息命令：`set_essence_msg`、`delete_essence_msg`、`get_essence_msg_list`
- 修复 `get_group_notice` 解析缺少 fallback 的问题

### v2.1 (2026-03-11)
- 新增 `query_messages` — 查询历史消息，自动解析 file_id

### v2.0 (2026-03-11)
- 新增 `send_file`、`send_record`、`send_video`、`download_file`

### v1.0 (2026-03-06)
- 初始版本：`send_message`、`get_sessions`、`get_group_members`

## 许可证

MIT
