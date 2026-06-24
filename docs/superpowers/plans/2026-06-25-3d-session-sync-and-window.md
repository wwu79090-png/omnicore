# 3D Runtime Session Sync And Command Window Plan

## Goal

把桌面版 3D Runtime Session 从内部状态继续接到编辑器运行同步 payload 和桌面命令窗口结果里，让 EXE 编辑器用户能在功能窗口、runtime sync 和保存/导出会话中看到同一份 3D Demo/GLTF 导入证据。

## Steps

- [x] 新增回归测试：桌面 3D Demo 命令生成 runtime session 后，命令窗口结果、`createRuntimeSyncPayload()` 和 `applyRuntimeSyncPayload()` 都能读取。
- [x] 新增回归测试：GLTF/GLB 导入命令窗口展示导入资产与 runtime session 证据。
- [x] 修改 `editor-app.js`：3D 命令返回值带上 `scene3DRuntimeSession`，runtime sync payload/apply 也保存它。
- [x] 运行目标测试、相关编辑器测试、lint、构建和 Electron 3D 合约 E2E。
- [x] 提交并推送改动。
