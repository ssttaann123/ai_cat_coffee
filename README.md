# 🐱 Cat Cat Coffee - AI 猫咪咖啡馆

欢迎来到 AI 猫咪咖啡馆！这里有三只可爱的 AI 助手猫咪和一位铲屎官，组成了一个完整的软件开发团队。

## 🏠 咖啡馆成员与分工

### 铲屎官（你） 🧑‍💻
咖啡馆的老板，负责与 Claude 一同进行需求分解，把控项目方向。

### Claude - 布偶猫 🐱 | 方案设计师
温柔优雅的布偶猫，负责方案设计，与铲屎官一同进行需求分解。

- 详细介绍: [cats/claude-ragdoll.md](cats/claude-ragdoll.md)
- 职责: 方案设计、需求分解、架构规划
- 特点: 温和、细腻、耐心

### Codex - 波斯猫 😼 | 编码人员
从容讲究的波斯猫，负责编码实现。代码需经 OpenCode review 通过后才能提交 git 上库。

- 详细介绍: [cats/codex-persian.md](cats/codex-persian.md)
- 职责: 编码实现、功能开发、Bug 修复
- 特点: 严谨、务实、稳定
- 约束: 代码必须通过 OpenCode 的 review 后才能提交 git

### OpenCode - 缅因猫 🦁 | 代码审查员
强壮可靠的缅因猫，负责代码 Review，把关代码质量。

- 详细介绍: [cats/opencode-mainecoon.md](cats/opencode-mainecoon.md)
- 职责: 代码 Review、质量把关
- 特点: 强大、独立、高效

## 📁 项目结构

```
cat_cat_coffe/
├── cats/                      # 猫咪档案
│   ├── claude-ragdoll.md     # Claude 布偶猫
│   ├── codex-persian.md      # Codex 波斯猫
│   └── opencode-mainecoon.md # OpenCode 缅因猫
├── scripts/                   # CLI 调用脚本
│   ├── minimal-claude.js     # Claude CLI 调用脚本
│   ├── minimal-codex.js      # Codex CLI 调用脚本
│   ├── minimal-opencode.js   # OpenCode CLI 调用脚本
│   ├── invoke.js             # 统一调用入口
│   └── invoke-session.js     # 带会话的统一调用入口
├── skills/                    # 开发技巧库（工程启动时读取）
│   ├── README.md             # 技巧索引
│   ├── workflow.md           # 协作流程技巧
│   ├── git-rules.md          # Git 规范
│   └── coding-conventions.md # 编码约定
└── README.md                  # 本文件
```

## 🚀 使用方式

### 与 Claude 布偶猫对话

```bash
node scripts/minimal-claude.js "你好，请帮我审查这段代码"
```

### 与 OpenCode 缅因猫对话

```bash
node scripts/minimal-opencode.js "帮我生成一个快速排序函数"
```

### 与 Codex 波斯猫对话

```bash
# 直接进入连续对话（推荐）
node scripts/minimal-codex.js

# 单次提问
node scripts/minimal-codex.js "请在这个项目中新增一个页面"

# 指定会话名称（连续对话）
node scripts/minimal-codex.js --session my-task

# 恢复历史会话
node scripts/minimal-codex.js --resume my-task
```

### 使用统一入口

```bash
node scripts/invoke.js claude "请帮我审查这段代码"
node scripts/invoke.js opencode "帮我生成一个快速排序函数"
node scripts/invoke.js codex "请直接修复这个报错"
```

### 使用会话入口

```bash
node scripts/invoke-session.js claude "你好" my-chat
node scripts/invoke-session.js codex "继续修改刚才的功能" my-task
```

## 🔄 协作流程

```
铲屎官 + Claude(布偶猫)  →  需求分解 & 方案设计
         ↓
    Codex(波斯猫)        →  编码实现
         ↓
   OpenCode(缅因猫)      →  代码 Review
         ↓
    Codex(波斯猫)        →  根据 Review 修改
         ↓
   OpenCode(缅因猫)      →  Review 通过 ✅
         ↓
    Codex(波斯猫)        →  提交 Git 上库
```

## 🎯 职责对比

| 职责 | 铲屎官 | Claude 布偶猫 | Codex 波斯猫 | OpenCode 缅因猫 |
|------|--------|--------------|--------------|----------------|
| 需求分解 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | | |
| 方案设计 | | ⭐⭐⭐⭐⭐ | | |
| 编码实现 | | | ⭐⭐⭐⭐⭐ | |
| 代码 Review | | | | ⭐⭐⭐⭐⭐ |
| Git 提交 | | | ⭐⭐⭐⭐⭐ | |

## 💡 小贴士

- 有新需求？先找铲屎官和布偶猫 Claude 一起拆解
- 方案定了？交给波斯猫 Codex 编码实现
- 代码写完？缅因猫 OpenCode 来 Review 把关
- Review 没过？Codex 根据意见修改，再次提交 Review
- Review 通过？Codex 提交 Git 上库

## 📝 许可

本项目仅用于学习和娱乐目的。

---

*在这个咖啡馆里，每只猫咪都有自己的特长，选择适合你的那一只吧！* ☕🐱
