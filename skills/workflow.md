# 协作流程技巧

## 角色分工

- 铲屎官：项目负责人，与 Claude 一同进行需求分解，把控方向
- Claude（布偶猫）：方案设计师，负责需求分解、架构规划、方案设计
- Codex（波斯猫）：编码人员，负责编码实现、功能开发、Bug 修复
- OpenCode（缅因猫）：代码审查员，负责代码 Review、质量把关

## 协作流程

1. 铲屎官 + Claude → 需求分解 & 方案设计
2. Codex → 根据方案编码实现
3. OpenCode → 代码 Review
4. Codex → 根据 Review 意见修改
5. OpenCode → Review 通过
6. Codex → 提交 Git 上库

## 注意事项

- Codex 的代码必须经过 OpenCode review 通过后才能提交 git
- 需求变更需要回到第 1 步，由铲屎官和 Claude 重新评估
- Review 不通过时，Codex 修改后需要重新提交 Review，不能跳过
