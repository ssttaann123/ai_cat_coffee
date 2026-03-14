# Git 规范

## 提交规则

- 只有 Codex（波斯猫）有权提交代码到 Git
- 提交前必须通过 OpenCode（缅因猫）的代码 Review
- Review 未通过的代码严禁上库

## Commit Message 格式

```
<type>: <简短描述>

<详细说明（可选）>
```

type 类型：
- feat: 新功能
- fix: Bug 修复
- refactor: 重构
- docs: 文档更新
- style: 代码格式调整
- test: 测试相关
- chore: 构建/工具变更

## Review 流程

1. Codex 完成编码后，提交代码给 OpenCode Review
2. OpenCode 检查代码质量、逻辑正确性、风格一致性
3. 如有问题，OpenCode 给出修改意见，Codex 修改后重新提交
4. Review 通过后，Codex 执行 git commit 和 push
