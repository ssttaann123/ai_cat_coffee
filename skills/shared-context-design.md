# 会话共享上下文设计

## 需求

三只猫（Claude、Codex、OpenCode）在协作时需要共享对话上下文。
当与任何一只猫开启会话时，它能看到之前所有猫的对话记录。

## 方案

### 共享日志文件

在 `.sessions/` 目录下维护一个 `shared-context.jsonl` 文件，每行一条记录：

```json
{"timestamp": "2026-03-14T09:30:00Z", "role": "铲屎官", "cat": "claude", "type": "prompt", "content": "请设计一个登录页面"}
{"timestamp": "2026-03-14T09:30:15Z", "role": "claude", "cat": "claude", "type": "response", "content": "好的，我建议使用..."}
```

### 调用流程

1. 调用任意猫时，读取 `shared-context.jsonl`
2. 将历史记录格式化为上下文摘要，注入到 prompt 前面
3. 猫完成回复后，将本次 prompt 和 response 追加到共享日志

### 上下文注入格式

```
[共享上下文 - 团队对话记录]
---
[09:30 Claude(方案设计师)] 铲屎官问: 请设计一个登录页面
[09:30 Claude(方案设计师)] 回复: 好的，我建议使用...
[09:35 Codex(编码人员)] 铲屎官问: 按照Claude的方案实现
[09:36 Codex(编码人员)] 回复: 已完成实现...
---
[当前对话开始]
```

### 上下文大小控制

- 默认保留最近 50 条记录
- 超过时截断旧记录，保留最新的
- 可通过 `--context-limit <n>` 参数调整

### 需要修改的文件

- `scripts/invoke-session.js` - 核心：加入共享上下文读写逻辑
- `scripts/minimal-claude.js` - 支持共享上下文
- `scripts/minimal-codex.js` - 支持共享上下文
- `scripts/minimal-opencode.js` - 支持共享上下文

### 新增文件

- `scripts/shared-context.js` - 共享上下文读写模块（独立模块，供各��本引用）
