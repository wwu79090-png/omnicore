# OmniCore 引擎退役与项目归档指南

OmniCore 会按照 `LTS.md` 中承诺的长期支持期限维护稳定版本、迁移说明和离线包。

如果在 LTS.md 承诺的长期支持期限结束后，引擎停止维护，我们将开放所有未发布的迁移工具脚本，并提供最后一版完全可用的离线包下载，确保开发者能够永久持有引擎。

## 退役时的项目自保步骤

1. 锁定最后一个 LTS 版本和对应 `package-lock.json`。
2. 下载最后一版离线包，并把 `OmniCore-v1.0.0-Offline.zip` 或后续 LTS 离线包归档到团队制品库。
3. 导出项目使用的 Store、Event Sheet、Prefab、Tilemap 和插件清单。
4. 使用公开迁移脚本生成 Phaser/Pixi/自研 runtime 的差异报告。
5. 保留 `docs/migration/why-omnicore.md`、`docs/api/` 和 `tests/contract/golden/` 作为迁移对照。

## 归档承诺

- 发布最终版本的完整源码和构建产物。
- 保留 GitHub Issues 只读入口，便于搜索历史问题。
- 标记最后一个可用文档快照。
- 公布迁移工具脚本、格式说明和已知限制。
