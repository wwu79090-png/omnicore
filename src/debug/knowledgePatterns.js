/* eslint-disable */
// Generated from ../../.knowledge-base/patterns.json. Do not edit by hand.
const knowledgePatterns = JSON.parse(String.raw`[
  {
    "id": "omni-kb-001",
    "title": "Store 状态类型漂移",
    "pattern": "Store.*(?:type mismatch|类型不一致|type drift|set type mismatch)",
    "flags": "i",
    "trigger": "Store.set 写入的值类型和初始状态类型不一致。",
    "intent": "保持状态结构稳定，避免同步和派生状态出现难以复现的状态错误。",
    "solution": "保持状态类型稳定；如果确实要迁移类型，先新增字段或在 migration/emergencyPatch 中显式转换。",
    "example": "store.set('hp', Number(nextHp));",
    "docs": "docs/DX.md#store-state-type-drift",
    "severity": "warn",
    "source": {
      "type": "seed",
      "issue": "seed-001",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-002",
    "title": "EventBus 递归事件循环",
    "pattern": "Event Loop Detected|OMNICORE_EVENT_RECURSION|recursion depth",
    "flags": "i",
    "trigger": "事件处理器同步 emit 自己或形成 A -> B -> A 循环。",
    "intent": "防止运行时死循环和帧预算被事件风暴耗尽。",
    "solution": "把递归 emit 改为 queueEvent/processEventFrame，或拆成一次性状态变更。",
    "example": "events.queueEvent('ready', payload); events.processEventFrame();",
    "docs": "docs/DX.md#eventbus-recursion",
    "severity": "error",
    "source": {
      "type": "seed",
      "issue": "seed-002",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-003",
    "title": "ECS 组件未注册",
    "pattern": "组件尚未注册|component.*not.*registered|Component storage .* exceeded",
    "flags": "i",
    "trigger": "调用 addComponent/getComponent 前没有 registerComponent，或容量不足。",
    "intent": "确保 ECS 数据列存在且容量可预测。",
    "solution": "在创建实体前注册组件描述，并为高实体量场景设置 capacity。",
    "example": "world.registerComponent({ name: 'Position', fields: { x: 'f32', y: 'f32' } });",
    "docs": "docs/DX.md#ecs-component-registration",
    "severity": "warn",
    "source": {
      "type": "seed",
      "issue": "seed-003",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-004",
    "title": "资源路径 404",
    "pattern": "404|failed to fetch|failed to load resource|资源路径",
    "flags": "i",
    "trigger": "Loader 或浏览器资源请求无法找到文件。",
    "intent": "让资源路径、manifest 和本地服务器根目录保持一致。",
    "solution": "检查 asset-manifest.json、public 根目录和大小写，避免直接用磁盘绝对路径。",
    "example": "await loader.loadBundle([{ key: 'hero', url: '/assets/hero.png', type: 'image' }]);",
    "docs": "docs/DX.md#asset-path-404",
    "severity": "warn",
    "source": {
      "type": "seed",
      "issue": "seed-004",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-005",
    "title": "对象未初始化",
    "pattern": "Cannot read properties of undefined|undefined \\(reading|对象未初始化",
    "flags": "i",
    "trigger": "请确认 Scene 或 Entity 已创建，并在调用 add、set、render 等方法前完成初始化。",
    "intent": "避免生命周期顺序错误导致空引用。",
    "solution": "把访问移动到 init/create 之后，或在 safeInitialize 里集中初始化依赖。",
    "example": "await game.init(); game.scene.push('boot');",
    "docs": "docs/DX.md#object-not-initialized",
    "severity": "error",
    "source": {
      "type": "seed",
      "issue": "seed-005",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-006",
    "title": "Physics 后端未初始化",
    "pattern": "attachBody 需要兼容 Matter\\.js|physics backend.*not initialized|setBackend",
    "flags": "i",
    "trigger": "创建刚体前没有安装或初始化物理后端。",
    "intent": "确保碰撞逻辑在统一后端 API 上运行。",
    "solution": "先调用 await physics.setBackend('matter', { module })，再创建刚体。",
    "example": "await world.setBackend('matter', { module: Matter }); world.createRigidBody({ id: 'hero' });",
    "docs": "docs/DX.md#physics-backend-init",
    "severity": "warn",
    "source": {
      "type": "seed",
      "issue": "seed-006",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-007",
    "title": "Renderer 后端切换未清理画布",
    "pattern": "multiple canvas|renderer switch|WebGL context lost",
    "flags": "i",
    "trigger": "切换渲染后端后旧 canvas 或 WebGL 状态残留。",
    "intent": "避免渲染上下文泄漏和重复输入命中。",
    "solution": "使用 BackendManager.switch，让引擎清理容器 canvas 并重建 renderer。",
    "example": "await game.backend.switch('canvas');",
    "docs": "docs/DX.md#renderer-backend-switch",
    "severity": "warn",
    "source": {
      "type": "seed",
      "issue": "seed-007",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-008",
    "title": "派生状态循环依赖",
    "pattern": "派生状态.*循环|derived.*cycle|dependency graph.*cycle",
    "flags": "i",
    "trigger": "Store.derive 之间形成闭环依赖。",
    "intent": "保持派生状态为有向无环图。",
    "solution": "把共享输入拆成普通状态字段，派生值只读基础字段。",
    "example": "store.derive('total', ['score', 'bonus'], ({ score, bonus }) => score + bonus);",
    "docs": "docs/DX.md#derived-state-cycle",
    "severity": "error",
    "source": {
      "type": "seed",
      "issue": "seed-008",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-009",
    "title": "WebAssembly 环境不可用",
    "pattern": "WebAssembly\\.instantiate|当前环境不支持 WebAssembly|wasm.*missing",
    "flags": "i",
    "trigger": "非浏览器或 Worker 环境没有提供 WebAssembly.instantiate。",
    "intent": "保证服务端结算在可执行 WASM 的环境中启动。",
    "solution": "在 Node.js 18+、Cloudflare Workers 或兼容 WASI 主机运行；缺失时启用 JS fallback。",
    "example": "const runtime = await createOmniCoreWasm({ path: 'dist/omnicore_core.wasm' });",
    "docs": "docs/server-runtime-compatibility-report.md#wasm",
    "severity": "error",
    "source": {
      "type": "seed",
      "issue": "seed-009",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-010",
    "title": "Worker 不支持 instantiateStreaming",
    "pattern": "instantiateStreaming|Cloudflare Workers.*wasm",
    "flags": "i",
    "trigger": "Cloudflare Workers 中使用 WebAssembly.instantiateStreaming 加载 wasm。",
    "intent": "符合 Worker 模块环境的非流式 wasm 加载限制。",
    "solution": "在模块顶层 import .wasm，再用 WebAssembly.instantiate(module)。",
    "example": "const instance = await WebAssembly.instantiate(wasm);",
    "docs": "docs/server-runtime-compatibility-report.md#cloudflare-workers",
    "severity": "warn",
    "source": {
      "type": "seed",
      "issue": "seed-010",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-011",
    "title": "模式 011：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_011",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 011。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-011",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-012",
    "title": "模式 012：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_012",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 012。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-012",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-013",
    "title": "模式 013：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_013",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 013。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-013",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-014",
    "title": "模式 014：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_014",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 014。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-014",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-015",
    "title": "模式 015：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_015",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 015。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-015",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-016",
    "title": "模式 016：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_016",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 016。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-016",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-017",
    "title": "模式 017：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_017",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 017。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-017",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-018",
    "title": "模式 018：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_018",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 018。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-018",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-019",
    "title": "模式 019：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_019",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 019。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-019",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-020",
    "title": "模式 020：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_020",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 020。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-020",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-021",
    "title": "模式 021：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_021",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 021。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-021",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-022",
    "title": "模式 022：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_022",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 022。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-022",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-023",
    "title": "模式 023：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_023",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 023。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-023",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-024",
    "title": "模式 024：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_024",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 024。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-024",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-025",
    "title": "模式 025：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_025",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 025。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-025",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-026",
    "title": "模式 026：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_026",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 026。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-026",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-027",
    "title": "模式 027：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_027",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 027。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-027",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-028",
    "title": "模式 028：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_028",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 028。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-028",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-029",
    "title": "模式 029：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_029",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 029。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-029",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-030",
    "title": "模式 030：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_030",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 030。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-030",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-031",
    "title": "模式 031：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_031",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 031。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-031",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-032",
    "title": "模式 032：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_032",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 032。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-032",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-033",
    "title": "模式 033：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_033",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 033。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-033",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-034",
    "title": "模式 034：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_034",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 034。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-034",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-035",
    "title": "模式 035：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_035",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 035。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-035",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-036",
    "title": "模式 036：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_036",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 036。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-036",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-037",
    "title": "模式 037：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_037",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 037。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-037",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-038",
    "title": "模式 038：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_038",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 038。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-038",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-039",
    "title": "模式 039：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_039",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 039。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-039",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-040",
    "title": "模式 040：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_040",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 040。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-040",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-041",
    "title": "模式 041：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_041",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 041。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-041",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-042",
    "title": "模式 042：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_042",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 042。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-042",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-043",
    "title": "模式 043：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_043",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 043。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-043",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-044",
    "title": "模式 044：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_044",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 044。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-044",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-045",
    "title": "模式 045：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_045",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 045。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-045",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-046",
    "title": "模式 046：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_046",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 046。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-046",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-047",
    "title": "模式 047：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_047",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 047。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-047",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-048",
    "title": "模式 048：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_048",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 048。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-048",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-049",
    "title": "模式 049：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_049",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 049。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-049",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-050",
    "title": "模式 050：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_050",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 050。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-050",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-051",
    "title": "模式 051：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_051",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 051。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-051",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-052",
    "title": "模式 052：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_052",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 052。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-052",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-053",
    "title": "模式 053：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_053",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 053。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-053",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-054",
    "title": "模式 054：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_054",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 054。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-054",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-055",
    "title": "模式 055：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_055",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 055。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-055",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-056",
    "title": "模式 056：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_056",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 056。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-056",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-057",
    "title": "模式 057：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_057",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 057。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-057",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-058",
    "title": "模式 058：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_058",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 058。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-058",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-059",
    "title": "模式 059：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_059",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 059。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-059",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-060",
    "title": "模式 060：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_060",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 060。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-060",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-061",
    "title": "模式 061：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_061",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 061。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-061",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-062",
    "title": "模式 062：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_062",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 062。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-062",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-063",
    "title": "模式 063：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_063",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 063。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-063",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-064",
    "title": "模式 064：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_064",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 064。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-064",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-065",
    "title": "模式 065：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_065",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 065。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-065",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-066",
    "title": "模式 066：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_066",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 066。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-066",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-067",
    "title": "模式 067：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_067",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 067。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-067",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-068",
    "title": "模式 068：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_068",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 068。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-068",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-069",
    "title": "模式 069：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_069",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 069。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-069",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-070",
    "title": "模式 070：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_070",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 070。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-070",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-071",
    "title": "模式 071：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_071",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 071。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-071",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-072",
    "title": "模式 072：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_072",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 072。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-072",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-073",
    "title": "模式 073：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_073",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 073。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-073",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-074",
    "title": "模式 074：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_074",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 074。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-074",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-075",
    "title": "模式 075：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_075",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 075。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-075",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-076",
    "title": "模式 076：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_076",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 076。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-076",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-077",
    "title": "模式 077：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_077",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 077。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-077",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-078",
    "title": "模式 078：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_078",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 078。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-078",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-079",
    "title": "模式 079：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_079",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 079。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-079",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-080",
    "title": "模式 080：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_080",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 080。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-080",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-081",
    "title": "模式 081：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_081",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 081。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-081",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-082",
    "title": "模式 082：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_082",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 082。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-082",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-083",
    "title": "模式 083：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_083",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 083。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-083",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-084",
    "title": "模式 084：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_084",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 084。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-084",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-085",
    "title": "模式 085：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_085",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 085。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-085",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-086",
    "title": "模式 086：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_086",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 086。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-086",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-087",
    "title": "模式 087：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_087",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 087。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-087",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-088",
    "title": "模式 088：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_088",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 088。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-088",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-089",
    "title": "模式 089：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_089",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 089。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-089",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-090",
    "title": "模式 090：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_090",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 090。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-090",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-091",
    "title": "模式 091：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_091",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 091。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-091",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-092",
    "title": "模式 092：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_092",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 092。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-092",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-093",
    "title": "模式 093：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_093",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 093。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-093",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-094",
    "title": "模式 094：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_094",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 094。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-094",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-095",
    "title": "模式 095：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_095",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 095。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-095",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-096",
    "title": "模式 096：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_096",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 096。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-096",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-097",
    "title": "模式 097：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_097",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 097。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-097",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-098",
    "title": "模式 098：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_098",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 098。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-098",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-099",
    "title": "模式 099：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_099",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 099。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-099",
      "repo": "omnicore/local"
    }
  },
  {
    "id": "omni-kb-100",
    "title": "模式 100：Issue 种子",
    "pattern": "OMNI_KB_PATTERN_100",
    "flags": "i",
    "trigger": "本地 Issue 提取前的种子触发条件 100。",
    "intent": "记录常见输入、状态、渲染、资源或构建错误模式。",
    "solution": "参考对应错误消息修正调用顺序、资源路径或配置。",
    "example": "node scripts/extract-knowledge-from-issues.js --repo owner/name",
    "docs": "docs/DX.md#knowledge-base",
    "severity": "info",
    "source": {
      "type": "seed",
      "issue": "seed-100",
      "repo": "omnicore/local"
    }
  }
]`);

export default knowledgePatterns;
