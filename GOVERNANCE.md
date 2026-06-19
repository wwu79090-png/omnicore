# OmniCore Governance

OmniCore 采用轻量维护治理模型，适合开源引擎和小团队持续迭代。

## 角色

- Contributor：提交文档、测试、示例或修复。
- Reviewer：连续合并 3 个有效 PR，且无回退事故后可被提名。
- Maintainer：连续两个小版本参与评审、发布和回归验证后可晋级。
- Lead Maintainer：负责版本路线、发布冻结和安全响应。

## 晋级机制

1. Maintainer 发起提名。
2. 至少两名 Reviewer 或 Maintainer 同意。
3. 新角色先经历一个小版本观察期。
4. 观察期内出现严重回归时自动回到原角色。

## 主维护者后备方案

如果 Lead Maintainer 连续 30 天无法响应安全漏洞或发布阻塞，活跃 Maintainer 可临时接管发布权限。临时接管需在 `CHANGELOG.md` 和 GitHub Release 中记录原因。

## 决策原则

- 兼容性优先：不破坏 `OmniCore.Game` 等公开 API。
- 测试优先：核心行为必须有单元测试或示例验证。
- 可回滚优先：迁移、资源打包和发布脚本必须保留原始数据副本。
