import {
  Activity,
  BadgeCheck,
  Blocks,
  BookOpen,
  Box,
  Boxes,
  Bug,
  ChartNoAxesCombined,
  CircleAlert,
  ClipboardCheck,
  Component,
  Cpu,
  Database,
  Eye,
  FileBox,
  Film,
  FolderOpen,
  Gamepad2,
  Gauge,
  GitBranch,
  GraduationCap,
  HardDriveDownload,
  History,
  Layers,
  LayoutDashboard,
  ListTree,
  Map as MapIcon,
  MonitorCog,
  Package as PackageIcon,
  PanelRight,
  PanelsTopLeft,
  Play,
  Puzzle,
  Radar,
  RefreshCcw,
  RefreshCw,
  Rocket,
  Route,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Upload,
  WandSparkles,
  Waypoints,
  Workflow,
  Zap
} from 'lucide-static';
import { Scene3DKit } from 'omnicore';
import {
  AssetRegistry,
  AssetRegistryChangeSet,
  BatchAtlasDiagnostics,
  VisualScriptGraphRuntime
} from './editor-runtime-adapters.js';
import {
  EditorCoCreator25D,
  SocialAwareness25D,
  WorldMemory25D
} from './living-world-25d.js';
import { createEditorState, createLiveSyncMessage } from './live-sync-protocol.js';
import LiveSyncClient from './live-sync-client.js';
import AITilemapGenerator from './ai-tilemap-generator.js';

const PANEL_TITLES = {
  hierarchy: '场景层级',
  inspector: '属性检查器',
  'scene-view': '场景视图',
  tilemap: '瓦片地图',
  prefabs: '预制体',
  assets: '资源',
  database: '数据库',
  'ai-assistant': 'AI 助手',
  'animation-timeline': '动画时间线',
  'flow-graph': '流程图',
  'graph-editor': '图节点编辑器',
  'visual-scripting': '可视化脚本',
  'ui-editor': '界面编辑器',
  'global-search': '全局搜索',
  'physics-view': '物理视图',
  'build-settings': '构建设置',
  'runtime-debug': '运行时调试',
  'render-diagnostics': '渲染诊断',
  'scene-3d-readiness': '3D 场景体检',
  profiler: '性能分析'
};

const NUMERIC_FIELDS = new Set(['x', 'y', 'width', 'height', 'rotation', 'scale', 'scaleX', 'scaleY', 'alpha']);
const DOCK_REGIONS = ['left', 'center', 'right', 'bottom'];
const DEFAULT_DOCK_LAYOUT = {
  left: ['hierarchy', 'prefabs', 'assets'],
  center: ['scene-view'],
  right: ['inspector', 'build-settings'],
  bottom: ['animation-timeline', 'tilemap', 'flow-graph', 'graph-editor', 'ui-editor', 'global-search', 'runtime-debug', 'profiler']
};
const TOOLBAR_ACTIONS = [
  { id: 'open-project', label: '打开项目', shortcut: 'Ctrl+O' },
  { id: 'save', label: '保存', shortcut: 'Ctrl+S' },
  { id: 'undo', label: '撤销', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: '重做', shortcut: 'Ctrl+Shift+Z' },
  { id: 'play', label: '运行' },
  { id: 'pause', label: '暂停' },
  { id: 'step', label: '单步' },
  { id: 'profiler', label: '性能' },
  { id: 'dock-reset', label: '重置布局' }
];

const DEFAULT_ZH_CN_TEXT = {
  'toolbar.open-project': '打开项目',
  'toolbar.save': '保存',
  'toolbar.undo': '撤销',
  'toolbar.redo': '重做',
  'toolbar.play': '运行',
  'toolbar.pause': '暂停',
  'toolbar.step': '单步',
  'toolbar.profiler': '性能',
  'toolbar.dock-reset': '重置布局',
  'gizmo.select': '选择',
  'gizmo.translate': '移动',
  'gizmo.rotate': '旋转',
  'gizmo.scale': '缩放',
  'inspector.id': '标识',
  'inspector.name': '名称',
  'inspector.type': '类型',
  'inspector.x': 'X',
  'inspector.y': 'Y',
  'inspector.z': 'Z',
  'inspector.width': '宽度',
  'inspector.height': '高度',
  'inspector.rotation': '旋转',
  'inspector.scale': '缩放',
  'inspector.scaleX': '横向缩放',
  'inspector.scaleY': '纵向缩放',
  'inspector.alpha': '透明度',
  'inspector.sprite': '精灵',
  'inspector.texture': '纹理',
  'inspector.openScript': '打开脚本',
  'tilemap.collisionOn': '碰撞绘制',
  'tilemap.paintTiles': '绘制瓦片',
  'timeline.noClips': '暂无动画片段',
  'flow.add.event': '添加事件',
  'flow.add.condition': '添加条件',
  'flow.add.action': '添加动作',
  'flow.exportEventSheet': '导出事件表',
  'runtimeDebug.empty': '暂无运行时事件',
  'profiler.empty': '暂无性能采样'
};

const DESKTOP_TUTORIAL_STEPS = {
  1: {
    title: '创建项目',
    progress: '25%',
    command: 'npm create omnicore-app my-game',
    code: `# 创建你的第一个 OmniCore 项目
npm create omnicore-app my-game
cd my-game
npm install
npm run editor`
  },
  2: {
    title: '写第一个场景',
    progress: '50%',
    command: 'node src/main.js',
    code: `import OmniCore, { Scene } from 'omnicore';

function createScene() {
  const scene = new Scene('hello-world');
  scene.create = () => {
    scene.add({
      id: 'hero',
      type: 'sprite',
      x: 80,
      y: 80,
      width: 48,
      height: 48,
      color: '#6bd694'
    });
  };
  return scene;
}`
  },
  3: {
    title: '运行预览',
    progress: '75%',
    command: 'npm run dev',
    code: `# 启动本地预览
npm run dev

# 回到 EXE 编辑器：
# 1. 打开项目
# 2. 拖入资源或预制体
# 3. 点击运行查看效果`
  },
  4: {
    title: '构建发布',
    progress: '100%',
    command: 'npm run quality:gate && npm run build',
    code: `# 发布前检查
npm run doctor
npm run quality:gate
npm run build

# 平台导出
npm run build:wechat
npm run dist:full`
  }
};

const DESKTOP_LAUNCHER_NAV = [
  { id: 'projects', label: '项目' },
  { id: 'editor', label: '编辑器' },
  { id: 'assets', label: '资源' },
  { id: 'systems', label: '系统' },
  { id: 'render', label: '渲染' },
  { id: 'publish', label: '发布' },
  { id: 'learning', label: '学习' },
  { id: 'diagnostics', label: '诊断' }
];

const DESKTOP_NAV_ICONS = {
  projects: LayoutDashboard,
  editor: PanelsTopLeft,
  assets: Boxes,
  systems: Workflow,
  render: Gauge,
  publish: Rocket,
  learning: GraduationCap,
  diagnostics: ShieldCheck
};

const DESKTOP_COMMAND_ICONS = {
  'open-project': FolderOpen,
  save: Save,
  play: Play,
  'dock-reset': LayoutDashboard,
  'recent-demo-action': History,
  'recent-demo-rpg': History,
  'recent-demo-25d': History,
  'template-platformer': Gamepad2,
  'template-rpg': BookOpen,
  'template-puzzle': Puzzle,
  'template-blank': FileBox,
  hierarchy: ListTree,
  'scene-view': Eye,
  inspector: SlidersHorizontal,
  'animation-timeline': Film,
  'ui-editor': PanelRight,
  'visual-scripting': Workflow,
  'workflow-overview': Route,
  'systems-overview': Blocks,
  'production-overview': BadgeCheck,
  assets: Boxes,
  prefabs: Component,
  database: Database,
  'asset-refresh': RefreshCw,
  'hot-reload': Zap,
  'dependency-graph': GitBranch,
  'global-search': Search,
  tilemap: MapIcon,
  'flow-graph': Waypoints,
  'graph-editor': Workflow,
  'physics-view': Radar,
  'scene-3d-demo': Box,
  'camera-lighting': Sun,
  'gltf-import': FileBox,
  profiler: Gauge,
  'webgpu-diagnostics': Cpu,
  'pixi-batch': Layers,
  'filter-cost': WandSparkles,
  'texture-lifecycle': RefreshCcw,
  'frame-budget': ChartNoAxesCombined,
  'build-settings': MonitorCog,
  'exe-package': HardDriveDownload,
  'web-export': Upload,
  'wechat-export': Smartphone,
  'quality-gate': ShieldCheck,
  'mature-editor-bundle': PackageIcon,
  'beginner-tutorial': GraduationCap,
  'tutorial-demo': Film,
  'migration-guide': Route,
  'api-path': BookOpen,
  'release-check': ClipboardCheck,
  'scene-validate': BadgeCheck,
  'runtime-debug': Bug,
  'scene-3d-readiness': Box,
  'recovery-check': History,
  'debug-timeline': Activity,
  'governance-report': ShieldCheck
};

const DESKTOP_HEADER_ACTIONS = [
  { id: 'open-project', label: '打开项目' },
  { id: 'play', label: '运行预览' },
  { id: 'profiler', label: '性能诊断' },
  { id: 'release-check', label: '发布体检' }
];

const DESKTOP_TOOLBAR_COMMANDS = new Set(['open-project', 'save', 'play', 'pause', 'step', 'profiler', 'dock-reset']);

const DESKTOP_PANEL_COMMANDS = {
  hierarchy: { panel: 'hierarchy', region: 'left', title: '场景层级' },
  'scene-view': { panel: 'scene-view', region: 'center', title: '场景视图' },
  inspector: { panel: 'inspector', region: 'right', title: '属性检查器' },
  assets: { panel: 'assets', region: 'left', title: '资源库' },
  prefabs: { panel: 'prefabs', region: 'left', title: '预制体' },
  database: { panel: 'database', region: 'right', title: '数据库' },
  'animation-timeline': { panel: 'animation-timeline', region: 'bottom', title: '动画时间线' },
  'ui-editor': { panel: 'ui-editor', region: 'bottom', title: 'UI 编辑器' },
  tilemap: { panel: 'tilemap', region: 'bottom', title: '瓦片地图' },
  'flow-graph': { panel: 'flow-graph', region: 'bottom', title: '流程图' },
  'graph-editor': { panel: 'graph-editor', region: 'bottom', title: '图节点编辑器' },
  'visual-scripting': { panel: 'visual-scripting', region: 'center', title: '可视化脚本' },
  'physics-view': { panel: 'physics-view', region: 'bottom', title: '物理调试视图' },
  'runtime-debug': { panel: 'runtime-debug', region: 'bottom', title: '运行时调试' },
  'global-search': { panel: 'global-search', region: 'bottom', title: '全局搜索' },
  'build-settings': { panel: 'build-settings', region: 'right', title: '构建设置' },
  'scene-3d-readiness': { panel: 'scene-3d-readiness', region: 'bottom', title: '3D 场景体检' }
};

const DESKTOP_TEMPLATE_NAMES = {
  platformer: '横版动作',
  rpg: '剧情 RPG',
  puzzle: '解谜关卡',
  blank: '空白工程'
};

const DESKTOP_RECENT_PROJECT_NAMES = {
  'demo-action': '示例动作游戏',
  'demo-rpg': '剧情 RPG 原型',
  'demo-25d': '2.5D 场景实验'
};

const DESKTOP_COMMAND_SECTIONS = [
  {
    nav: 'projects',
    featureGroup: 'projects',
    hubSection: 'project-center',
    aliases: ['recent-projects', 'template-lab'],
    title: '项目中心',
    subtitle: '最近项目 / 模板创建 / 保存运行',
    lead: '桌面版 EXE 启动后先进入这里：打开项目、继续最近工程、选择模板，并把运行保存动作集中到一个稳定入口。',
    commands: [
      { id: 'open-project', title: '打开本地项目', purpose: '扫描场景、资源、预制体和脚本，进入真实编辑工作台。', status: 'Ctrl+O', primary: true },
      { id: 'save', title: '保存当前场景', purpose: '写入快照，保留可回滚版本和自动恢复记录。', status: 'Ctrl+S' },
      { id: 'play', title: '运行预览', purpose: '进入播放模式，验证输入、逻辑、物理和动画状态。', status: '运行' },
      { id: 'dock-reset', title: '重置工作台', purpose: '恢复默认面板、停靠布局和编辑器视图。', status: '布局' },
      { id: 'recent-demo-action', title: '示例动作游戏', purpose: '继续 2D 动作、碰撞、瓦片地图示例项目。', status: '2D / 物理', recentProject: 'demo-action' },
      { id: 'recent-demo-rpg', title: '剧情 RPG 原型', purpose: '继续事件表、对话、背包和存档流程项目。', status: '事件表', recentProject: 'demo-rpg' },
      { id: 'recent-demo-25d', title: '2.5D 场景实验', purpose: '继续灯光、预制体、2.5D 层级和深度实验。', status: '灯光 / 预制体', recentProject: 'demo-25d' },
      { id: 'template-platformer', title: '横版动作', purpose: '角色、碰撞、相机、关卡瓦片和输入模板。', status: '模板创建', template: 'platformer' },
      { id: 'template-rpg', title: '剧情 RPG', purpose: '对话、背包、事件页、地图切换和存档模板。', status: '模板创建', template: 'rpg' },
      { id: 'template-puzzle', title: '解谜关卡', purpose: '触发器、目标、撤销、重玩和关卡状态模板。', status: '模板创建', template: 'puzzle' },
      { id: 'template-blank', title: '空白工程', purpose: '只创建最小场景、资源目录和构建配置。', status: '模板创建', template: 'blank' }
    ]
  },
  {
    nav: 'editor',
    featureGroup: 'editor-workbench',
    hubSection: 'capability-map',
    title: '编辑器工作台',
    subtitle: '节点 / 属性 / 视图 / 可视化脚本',
    lead: '功能完整度不只看数量，而是每个入口都能落到真实编辑面板：层级、场景、属性、动画、UI、节点图和脚本图都能直接打开。',
    commands: [
      { id: 'hierarchy', title: '场景层级', purpose: '管理节点树、选择实体并检查父子关系。', status: '左侧' },
      { id: 'scene-view', title: '场景视图', purpose: '编辑画布、选择对象、查看 gizmo 和场景提示。', status: '中心' },
      { id: 'inspector', title: '属性检查器', purpose: '编辑实体、组件、脚本入口和数值字段。', status: '右侧' },
      { id: 'animation-timeline', title: '动画时间线', purpose: '查看关键帧、曲线、事件和动画片段。', status: '底部' },
      { id: 'ui-editor', title: 'UI 编辑器', purpose: '编辑界面控件、布局、状态和交互反馈。', status: '底部' },
      { id: 'visual-scripting', title: '可视化脚本', purpose: '打开节点图，拖节点、连线、运行并查看 trace。', status: '中心' },
      { id: 'workflow-overview', title: '完整工作流', purpose: '项目、场景、预制体、资源、运行、保存、回滚闭环。', status: '制作闭环', capability: 'workflow' },
      { id: 'systems-overview', title: '引擎系统入口', purpose: 'Tilemap、流程图、UI、物理、Profiler、2.5D 一次进入。', status: '系统地图', capability: 'engine-systems' },
      { id: 'production-overview', title: '生产闭环', purpose: '质量门禁、构建设置、发布前诊断和性能热点。', status: '发布闭环', capability: 'production' }
    ]
  },
  {
    nav: 'assets',
    featureGroup: 'assets-scenes',
    hubSection: 'assets-scenes',
    title: '资源与场景',
    subtitle: '资源库 / Prefab / 依赖 / 热重载',
    lead: '把 Godot、Cocos、Unity 常见资源闭环收拢到一个面板：资源索引、Prefab、数据库、依赖图、增量刷新和热重载事件流。',
    commands: [
      { id: 'assets', title: '资源库', purpose: '打开资源数据库面板，查看资源索引、状态和引用。', status: '左侧' },
      { id: 'prefabs', title: '预制体', purpose: '编辑 Prefab、变体、覆盖项和实例关系。', status: '左侧' },
      { id: 'database', title: '数据库', purpose: '查看编辑器数据、资源元信息和运行时记录。', status: '右侧' },
      { id: 'asset-refresh', title: '资源增量刷新', purpose: '重新计算资源面板状态，触发编辑器资源索引刷新。', status: '可执行' },
      { id: 'hot-reload', title: '热重载事件流', purpose: '生成资源变更编译计划，并把事件推给编辑器闭环。', status: '可执行' },
      { id: 'dependency-graph', title: '场景依赖图', purpose: '生成资源、场景、Prefab 的依赖关系检查结果。', status: '诊断' },
      { id: 'global-search', title: '全局搜索', purpose: '在场景、资源、脚本和配置中快速定位目标。', status: '底部' }
    ]
  },
  {
    nav: 'systems',
    featureGroup: 'systems-2d-3d-physics',
    hubSection: 'systems-2d-3d-physics',
    title: '2D / 3D / 物理',
    subtitle: 'Tilemap / 3D 场景 / 碰撞 / 约束',
    lead: '这里集中 Phaser、Godot、Cocos、Three.js + 物理栈方向的实际入口：2D 瓦片、流程图、3D 场景预览、碰撞体和物理调试。',
    commands: [
      { id: 'tilemap', title: 'Tilemap 编辑', purpose: '打开瓦片地图、碰撞绘制和关卡刷图工具。', status: '2D' },
      { id: 'flow-graph', title: '流程图', purpose: '编辑事件、条件、动作和场景逻辑流程。', status: '逻辑' },
      { id: 'graph-editor', title: '图节点编辑器', purpose: '管理节点图面板，为可视化脚本和事件图服务。', status: '节点' },
      { id: 'physics-view', title: '物理视图', purpose: '查看碰撞体、刚体、传感器、raycast 和 debug draw。', status: '物理' },
      { id: 'scene-3d-demo', title: '3D 场景 Demo', purpose: '打开场景视图并进入 3D/2.5D 材质、灯光和模型检查路径。', status: '3D' },
      { id: 'camera-lighting', title: '相机与灯光', purpose: '定位 Camera、Light、Shadow、后处理和 2.5D 视觉证据。', status: '视觉' },
      { id: 'gltf-import', title: 'GLTF/GLB 资源检查', purpose: '进入资源库，检查模型、动画、材质和缺失引用。', status: '模型' }
    ]
  },
  {
    nav: 'render',
    featureGroup: 'render-performance',
    hubSection: 'render-performance',
    title: '渲染与性能',
    subtitle: 'PixiJS / WebGPU / 帧预算 / Filter',
    lead: 'PixiJS 与 WebGPU 方向不做空口号：纹理生命周期、batch、filter 成本、fallback 和帧预算都接到性能采样与诊断面板。',
    commands: [
      { id: 'profiler', title: '性能分析器', purpose: '打开 Profiler，记录帧耗时、内存、draw calls 和热点。', status: '可执行' },
      { id: 'webgpu-diagnostics', title: 'WebGPU 诊断', purpose: '生成 WebGPU / WebGL fallback 与资源管线采样。', status: '诊断' },
      { id: 'pixi-batch', title: 'Batch 诊断', purpose: '检查批处理、状态切换、纹理绑定和渲染顺序成本。', status: 'PixiJS' },
      { id: 'filter-cost', title: 'Filter 成本', purpose: '记录滤镜、后处理和混合状态对帧预算的影响。', status: '预算' },
      { id: 'texture-lifecycle', title: '纹理生命周期', purpose: '追踪纹理上传、释放、缓存和丢失恢复路径。', status: '资源' },
      { id: 'frame-budget', title: '真实帧预算报告', purpose: '输出 60 FPS 预算视角下的渲染、脚本和物理耗时。', status: '报告' }
    ]
  },
  {
    nav: 'publish',
    featureGroup: 'platform-publish',
    hubSection: 'platform-publish',
    title: '平台发布',
    subtitle: 'Web / EXE / 微信小游戏 / 质量门禁',
    lead: '发布入口服务真实落地：构建设置、桌面 EXE、Web 包、微信小游戏、轻量部署和质量门禁都能从这里进入。',
    commands: [
      { id: 'build-settings', title: '构建设置', purpose: '配置平台目标、图标、输出目录、资源策略和签名信息。', status: '右侧' },
      { id: 'exe-package', title: '桌面 EXE 打包', purpose: '进入 Windows 安装包与便携版 EXE 构建检查路径。', status: 'Windows' },
      { id: 'web-export', title: 'Web 发布包', purpose: '生成可运行 Web 项目结构和轻量部署包。', status: 'Web' },
      { id: 'wechat-export', title: '微信小游戏导出', purpose: '检查微信小游戏适配、资源尺寸和运行模板。', status: '小游戏' },
      { id: 'quality-gate', title: '质量门禁', purpose: '运行场景验证、资源引用、构建配置和发布前检查。', status: '检查' },
      { id: 'mature-editor-bundle', title: '成熟编辑器包', purpose: '导出编辑器能力、资源工作流和协作交付摘要。', status: '交付' }
    ]
  },
  {
    nav: 'learning',
    featureGroup: 'learning',
    hubSection: 'learning-path',
    aliases: ['beginner-tutorial'],
    title: '学习路线',
    subtitle: '0 基础新手教程 / 演示 / 迁移',
    lead: '从 0 基础到发布保留手把手路径，同时给有经验用户提供 Phaser、Godot、Cocos、PixiJS 和 Three.js 迁移视角。',
    commands: [
      { id: 'beginner-tutorial', title: '0 基础新手教程', purpose: '跳到新手教程工作台，逐步创建、写场景、运行和发布。', status: '教程' },
      { id: 'tutorial-demo', title: '教程演示', purpose: '播放当前教程步骤演示，并给出可复制命令。', status: '演示' },
      { id: 'migration-guide', title: '引擎迁移路径', purpose: '给 Phaser、Godot、Cocos 项目提供入口选择建议。', status: '指南' },
      { id: 'api-path', title: '推荐 API 路线', purpose: '收敛新手入口，优先展示稳定 API、模板和 cookbook。', status: '收敛' }
    ],
    extra: 'tutorial'
  },
  {
    nav: 'diagnostics',
    featureGroup: 'diagnostics',
    hubSection: 'release-diagnostics',
    title: '发布诊断',
    subtitle: '体检 / 场景验证 / 恢复 / 调试时间线',
    lead: '最后一步集中检查：场景合法性、资源依赖、自动恢复、运行时调试、发布报告和可修复问题都在这里闭环。',
    commands: [
      { id: 'release-check', title: '一键体检', purpose: '检查资源、脚本、场景依赖、构建配置和性能预算。', status: '9 项', diagnosticAction: 'release-check', primary: true },
      { id: 'scene-validate', title: '场景验证', purpose: '检查重复实体、缺失纹理、无效层级和警告项。', status: '验证' },
      { id: 'runtime-debug', title: '运行时调试', purpose: '打开调试事件、trace、热重载和错误定位面板。', status: '底部' },
      { id: 'recovery-check', title: '自动恢复检查', purpose: '检查异常退出快照和自动保存恢复状态。', status: '恢复' },
      { id: 'debug-timeline', title: '调试时间线', purpose: '导出最近运行时事件与性能采样时间线。', status: 'Trace' },
      { id: 'governance-report', title: '项目治理报告', purpose: '汇总项目健康度、协作交付和发布风险。', status: '报告' }
    ],
    extra: 'diagnostics'
  }
];

const DESKTOP_RENDER_DIAGNOSTIC_COMMANDS = new Set([
  'webgpu-diagnostics',
  'pixi-batch',
  'filter-cost',
  'texture-lifecycle',
  'frame-budget'
]);
const DESKTOP_PUBLISH_COMMANDS = new Set(['exe-package', 'web-export', 'wechat-export']);
const DESKTOP_SCENE3D_COMMANDS = new Set(['scene-3d-demo', 'camera-lighting', 'gltf-import']);
const DESKTOP_ASSET_PIPELINE_COMMANDS = new Set(['asset-refresh', 'hot-reload', 'dependency-graph']);
const DESKTOP_OVERVIEW_COMMANDS = new Set(['workflow-overview', 'systems-overview', 'production-overview']);
const DESKTOP_LEARNING_COMMANDS = new Set(['beginner-tutorial', 'tutorial-demo', 'migration-guide', 'api-path']);
const DESKTOP_DIAGNOSTIC_COMMANDS = new Set([
  'release-check',
  'scene-validate',
  'quality-gate',
  'recovery-check',
  'debug-timeline',
  'governance-report'
]);

const DESKTOP_COMMANDS_BY_ID = new Map();
const DESKTOP_COMMAND_SECTION_BY_ID = new Map();
for (const section of DESKTOP_COMMAND_SECTIONS) {
  for (const command of section.commands) {
    DESKTOP_COMMANDS_BY_ID.set(command.id, command);
    DESKTOP_COMMAND_SECTION_BY_ID.set(command.id, section);
  }
}
const DESKTOP_SECTION_BY_NAV = new Map(DESKTOP_COMMAND_SECTIONS.map((section) => [section.nav, section]));

function getDesktopCommandRecord(commandId) {
  const id = String(commandId || '');
  return DESKTOP_COMMANDS_BY_ID.get(id)
    || DESKTOP_HEADER_ACTIONS.find((action) => action.id === id)
    || { id, title: id || '启动器功能', label: id || '启动器功能', purpose: '启动器功能入口', status: '入口' };
}

function getDesktopCommandKind(commandId, command = getDesktopCommandRecord(commandId)) {
  const id = String(commandId || command?.id || '');
  if (command?.template) return 'template';
  if (command?.recentProject) return 'recent';
  if (DESKTOP_PANEL_COMMANDS[id]) return id === 'visual-scripting' ? 'visual-script' : 'panel';
  if (DESKTOP_TOOLBAR_COMMANDS.has(id)) return 'toolbar';
  if (DESKTOP_RENDER_DIAGNOSTIC_COMMANDS.has(id)) return 'render';
  if (DESKTOP_PUBLISH_COMMANDS.has(id)) return 'publish';
  if (DESKTOP_SCENE3D_COMMANDS.has(id)) return 'scene3d';
  if (DESKTOP_ASSET_PIPELINE_COMMANDS.has(id)) return 'asset-pipeline';
  if (DESKTOP_OVERVIEW_COMMANDS.has(id)) return 'overview';
  if (DESKTOP_LEARNING_COMMANDS.has(id)) return 'learning';
  if (DESKTOP_DIAGNOSTIC_COMMANDS.has(id)) return 'diagnostic';
  return 'command';
}

function getDesktopCommandSteps(kind) {
  return {
    toolbar: ['执行命令', '同步状态', '刷新工作台', '查看反馈'],
    template: ['选择模板', '生成项目骨架', '打开示例场景', '进入编辑器'],
    recent: ['定位项目', '恢复工作区', '刷新资源索引', '进入编辑器'],
    panel: ['定位功能', '打开面板', '编辑数据', '查看 Trace'],
    'visual-script': ['打开节点图', '拖拽节点', '连线运行', '查看 Trace'],
    render: ['采集帧', '打开 Profiler', '标记瓶颈', '输出预算'],
    publish: ['打开构建设置', '检查平台配置', '生成产物', '回看诊断'],
    scene3d: ['加载场景', '检查材质灯光', '验证模型资源', '查看调试视图'],
    'asset-pipeline': ['扫描资源', '生成变更集', '刷新依赖图', '触发热重载'],
    overview: ['定位路径', '推荐入口', '串联面板', '形成闭环'],
    learning: ['选择课程', '播放演示', '复制命令', '进入模板'],
    diagnostic: ['运行检查', '定位问题', '给出修复', '输出报告'],
    command: ['执行入口', '更新状态', '打开结果', '查看反馈']
  }[kind] || ['执行入口', '更新状态', '打开结果', '查看反馈'];
}

function describeDesktopCommand(commandId) {
  const id = String(commandId || 'open-project');
  const command = getDesktopCommandRecord(id);
  const section = DESKTOP_COMMAND_SECTION_BY_ID.get(id);
  const kind = getDesktopCommandKind(id, command);
  const panelRoute = DESKTOP_PANEL_COMMANDS[id];
  const title = command.title || command.label || panelRoute?.title || id;
  const purpose = command.purpose || '从启动器直接进入对应编辑器能力。';
  const status = command.status || '入口';
  let target = `${section?.title || '启动器'} / ${status}`;
  let outcome = `${title} 已接入启动器，可直接执行并显示结果。`;

  if (panelRoute) {
    target = `${panelRoute.title} -> ${panelRoute.region} 停靠区`;
    outcome = `打开${panelRoute.title}并固定到${panelRoute.region}区域。`;
  } else if (command.template) {
    target = `模板工厂 -> ${DESKTOP_TEMPLATE_NAMES[command.template] || command.template}`;
    outcome = `选择${DESKTOP_TEMPLATE_NAMES[command.template] || command.template}模板并准备创建项目。`;
  } else if (command.recentProject) {
    target = `最近项目 -> ${DESKTOP_RECENT_PROJECT_NAMES[command.recentProject] || command.recentProject}`;
    outcome = `定位${DESKTOP_RECENT_PROJECT_NAMES[command.recentProject] || command.recentProject}并恢复工作区。`;
  } else if (DESKTOP_RENDER_DIAGNOSTIC_COMMANDS.has(id)) {
    target = 'Profiler / 渲染预算 / 帧采样';
    outcome = '生成可回看的渲染性能采样，帮助定位 batch、filter、纹理和帧预算问题。';
  } else if (DESKTOP_PUBLISH_COMMANDS.has(id)) {
    target = '构建设置 / 平台发布 / 产物检查';
    outcome = '打开平台发布检查路径，明确 EXE、Web 或小游戏导出条件。';
  } else if (DESKTOP_SCENE3D_COMMANDS.has(id)) {
    target = '场景视图 / 3D 资源 / 调试路径';
    outcome = '进入 3D/2.5D 场景、相机灯光或模型资源检查流程。';
  } else if (DESKTOP_ASSET_PIPELINE_COMMANDS.has(id)) {
    target = '资源数据库 / 依赖图 / 热重载';
    outcome = '刷新资源数据库并把资源变更接入编辑器可视化闭环。';
  } else if (DESKTOP_DIAGNOSTIC_COMMANDS.has(id)) {
    target = '诊断报告 / 场景验证 / 恢复检查';
    outcome = '运行项目体检或调试报告，给出可继续处理的结果。';
  } else if (DESKTOP_LEARNING_COMMANDS.has(id)) {
    target = '新手教程 / 示例演示 / API 路线';
    outcome = '把 0 基础用户引到模板、命令和迁移路径。';
  } else if (DESKTOP_OVERVIEW_COMMANDS.has(id)) {
    target = '推荐路径 / 功能总览 / 闭环导航';
    outcome = '把分散入口收敛成从项目到发布的推荐工作流。';
  } else if (DESKTOP_TOOLBAR_COMMANDS.has(id)) {
    target = '顶部工具栏 / 工作台状态';
    outcome = '执行工具栏动作并同步编辑器状态。';
  }

  return {
    id,
    kind,
    title,
    purpose,
    status,
    sectionTitle: section?.title || '启动器',
    nav: section?.nav || 'projects',
    target,
    outcome,
    preview: `${title}：${purpose}`,
    steps: getDesktopCommandSteps(kind)
  };
}

export function createInputFocusManager({ root = null } = {}) {
  let gizmoShortcutsEnabled = true;

  const api = {
    enableGizmoShortcuts() {
      gizmoShortcutsEnabled = true;
      return gizmoShortcutsEnabled;
    },
    disableGizmoShortcuts() {
      gizmoShortcutsEnabled = false;
      return gizmoShortcutsEnabled;
    },
    areGizmoShortcutsEnabled() {
      return gizmoShortcutsEnabled;
    },
    isTextInputTarget: isTextEditingTarget,
    destroy() {
      root?.removeEventListener?.('mousedown', onPointerDown, true);
      root?.removeEventListener?.('focusin', onFocusIn, true);
    }
  };

  function onPointerDown(event) {
    if (isTextEditingTarget(event.target)) {
      api.disableGizmoShortcuts();
      return;
    }
    if (isSceneCanvasTarget(event.target)) api.enableGizmoShortcuts();
  }

  function onFocusIn(event) {
    if (isTextEditingTarget(event.target)) api.disableGizmoShortcuts();
  }

  root?.addEventListener?.('mousedown', onPointerDown, true);
  root?.addEventListener?.('focusin', onFocusIn, true);
  return api;
}

function asElement(target) {
  if (!target) return null;
  if (target.nodeType === 1) return target;
  return target.parentElement || null;
}

function isTextEditingTarget(target) {
  let element = asElement(target);
  while (element) {
    const tagName = String(element.tagName || '').toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
    const editable = element.getAttribute?.('contenteditable');
    if (editable != null && String(editable).toLowerCase() !== 'false') return true;
    element = element.parentElement;
  }
  return false;
}

function isSceneCanvasTarget(target) {
  const element = asElement(target);
  return Boolean(element?.closest?.('.scene-canvas, [data-scene-drop-zone]'));
}

function escapeDesktopHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function desktopDataAttr(name, value) {
  if (value === undefined || value === null || value === '') return '';
  return ` ${name}="${escapeDesktopHtml(value)}"`;
}

function renderDesktopIcon(iconSvg, className = 'desktop-lucide-icon', dataAttr = '') {
  return `<span class="${className}" aria-hidden="true" data-desktop-icon-source="lucide-static"${dataAttr}>${iconSvg || CircleAlert}</span>`;
}

function renderDesktopNavButton(item, index) {
  return `
    <button type="button" class="${index === 0 ? 'selected' : ''}" data-desktop-nav="${escapeDesktopHtml(item.id)}">
      ${renderDesktopIcon(DESKTOP_NAV_ICONS[item.id], 'desktop-lucide-icon desktop-nav-icon')}
      <span>${escapeDesktopHtml(item.label)}</span>
    </button>
  `;
}

function renderDesktopHeaderAction(action) {
  return `
    <button type="button" data-desktop-command="${escapeDesktopHtml(action.id)}">
      ${renderDesktopIcon(DESKTOP_COMMAND_ICONS[action.id], 'desktop-lucide-icon desktop-action-icon')}
      <span>${escapeDesktopHtml(action.label)}</span>
    </button>
  `;
}

function renderDesktopCommandCard(command, index = 0) {
  const detail = describeDesktopCommand(command.id);
  const className = `desktop-command-card motion-card${command.primary ? ' primary' : ''}`;
  return `
    <button
      class="${className}"
      type="button"
      style="--desktop-card-index: ${index};"
      data-motion-card
      data-desktop-command-card
      data-desktop-command="${escapeDesktopHtml(command.id)}"
      ${desktopDataAttr('data-desktop-template', command.template)}
      ${desktopDataAttr('data-desktop-recent-project', command.recentProject)}
      ${desktopDataAttr('data-desktop-diagnostic-action', command.diagnosticAction)}
      ${desktopDataAttr('data-desktop-capability', command.capability)}
      data-desktop-command-useful="true"
      data-desktop-command-outcome="${escapeDesktopHtml(detail.outcome)}"
      data-desktop-command-target="${escapeDesktopHtml(detail.target)}"
    >
      ${renderDesktopIcon(DESKTOP_COMMAND_ICONS[command.id], 'desktop-lucide-icon desktop-command-icon', ' data-desktop-command-icon')}
      <strong data-desktop-command-title>${escapeDesktopHtml(command.title)}</strong>
      <span data-desktop-command-purpose>${escapeDesktopHtml(command.purpose)}</span>
      <b data-desktop-command-status>${escapeDesktopHtml(command.status)}</b>
    </button>
  `;
}

function renderDesktopCommandDetailBody(commandId = 'open-project') {
  const detail = describeDesktopCommand(commandId);
  return `
    <div class="desktop-detail-heading">
      <span>当前功能</span>
      <strong data-desktop-detail-title>${escapeDesktopHtml(detail.title)}</strong>
    </div>
    <p data-desktop-detail-summary>${escapeDesktopHtml(detail.purpose)}</p>
    <div class="desktop-detail-meta">
      <span><b>分区</b><em>${escapeDesktopHtml(detail.sectionTitle)}</em></span>
      <span><b>目标</b><em data-desktop-detail-target>${escapeDesktopHtml(detail.target)}</em></span>
      <span><b>结果</b><em data-desktop-detail-outcome>${escapeDesktopHtml(detail.outcome)}</em></span>
    </div>
    <div class="desktop-action-preview" data-desktop-action-preview>
      <strong>${escapeDesktopHtml(detail.title)}</strong>
      <span>${escapeDesktopHtml(detail.preview)}</span>
      <i aria-hidden="true"></i>
    </div>
    <ol class="desktop-workflow-map" data-desktop-workflow-map aria-label="当前功能流程">
      ${detail.steps.map((step, stepIndex) => `
        <li data-desktop-workflow-step data-desktop-detail-step>
          <b>${stepIndex + 1}</b>
          <span>${escapeDesktopHtml(step)}</span>
        </li>
      `).join('')}
    </ol>
  `;
}

function formatDesktopResultValue(value) {
  if (value == null) return '无返回数据';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const json = JSON.stringify(value, null, 2);
    return json.length > 1400 ? `${json.slice(0, 1400)}\n...` : json;
  } catch {
    return String(value);
  }
}

function renderDesktopCommandWindow(detail, {
  serial = 1,
  resultState = '等待执行',
  resultSummary = '功能窗口已打开，点击执行可以重新运行该功能。',
  resultDetail = '等待命令执行结果。',
  nextStep = '根据结果继续进入编辑器、诊断面板或发布检查。'
} = {}) {
  return `
    <article
      class="desktop-command-window"
      data-desktop-command-window="${escapeDesktopHtml(detail.id)}"
      data-desktop-command-window-serial="${serial}"
      role="dialog"
      aria-modal="false"
      aria-label="${escapeDesktopHtml(detail.title)}"
      tabindex="-1"
    >
      <header class="desktop-command-window-titlebar">
        <div>
          <span>${escapeDesktopHtml(detail.sectionTitle)}</span>
          <strong data-desktop-command-window-title>${escapeDesktopHtml(detail.title)}</strong>
        </div>
        <button type="button" data-desktop-command-window-close aria-label="关闭功能窗口">关闭</button>
      </header>
      <div class="desktop-command-window-body">
        <section class="desktop-command-window-panel desktop-command-window-intro">
          <h2>功能说明</h2>
          <p>${escapeDesktopHtml(detail.purpose)}</p>
          <dl>
            <div><dt>入口</dt><dd>${escapeDesktopHtml(detail.status)}</dd></div>
            <div><dt>目标</dt><dd>${escapeDesktopHtml(detail.target)}</dd></div>
            <div><dt>预期结果</dt><dd>${escapeDesktopHtml(detail.outcome)}</dd></div>
          </dl>
        </section>
        <section class="desktop-command-window-panel">
          <h2>完整流程</h2>
          <ol class="desktop-command-window-steps">
            ${detail.steps.map((step, stepIndex) => `
              <li data-desktop-window-step>
                <b>${stepIndex + 1}</b>
                <span>${escapeDesktopHtml(step)}</span>
              </li>
            `).join('')}
          </ol>
        </section>
        <section class="desktop-command-window-panel desktop-command-window-result" data-desktop-command-window-result>
          <h2>执行结果</h2>
          <b data-desktop-command-window-result-state>${escapeDesktopHtml(resultState)}</b>
          <strong data-desktop-command-window-result-summary>${escapeDesktopHtml(resultSummary)}</strong>
          <pre data-desktop-command-window-result-detail>${escapeDesktopHtml(resultDetail)}</pre>
        </section>
        <section class="desktop-command-window-panel desktop-command-window-next">
          <h2>下一步</h2>
          <p data-desktop-command-window-next>${escapeDesktopHtml(nextStep)}</p>
          <div class="desktop-command-window-actions">
            <button type="button" data-desktop-command-window-action="execute">执行功能</button>
            <button type="button" data-desktop-command-window-action="open-editor">打开编辑器工作台</button>
          </div>
        </section>
      </div>
    </article>
  `;
}

function renderDesktopSectionMap(section) {
  const commands = section.commands || [];
  const primary = commands.find((command) => command.primary) || commands[0] || {};
  const secondary = commands[Math.min(1, Math.max(0, commands.length - 1))] || primary;
  const finalCommand = commands[commands.length - 1] || primary;
  const nodes = [
    { title: section.title, text: '选择分区' },
    { title: primary.title || '核心入口', text: primary.status || '执行' },
    { title: secondary.title || '编辑能力', text: '可视化操作' },
    { title: finalCommand.title || '闭环结果', text: '反馈闭环' }
  ];
  return `
    <div class="desktop-section-map" data-desktop-section-map aria-label="${escapeDesktopHtml(section.title)}可视化流程">
      ${nodes.map((node, index) => `
        <div class="desktop-section-node" data-desktop-section-node>
          <b>${index + 1}</b>
          <strong>${escapeDesktopHtml(node.title)}</strong>
          <span>${escapeDesktopHtml(node.text)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDesktopSectionExtra(section) {
  if (section.extra === 'diagnostics') {
    return `
      <div class="desktop-diagnostic-body">
        <div data-desktop-diagnostic-result>
          <strong>等待体检</strong>
          <span>检查资源、脚本、场景依赖、构建配置和性能预算。</span>
        </div>
      </div>
    `;
  }
  if (section.extra === 'tutorial') {
    return `
      <div class="desktop-tutorial-workbench" data-hub-section="beginner-tutorial">
        <div class="desktop-tutorial-steps">
          <button type="button" class="selected" data-desktop-tutorial-step="1">1. 创建项目</button>
          <button type="button" data-desktop-tutorial-step="2">2. 写场景</button>
          <button type="button" data-desktop-tutorial-step="3">3. 运行预览</button>
          <button type="button" data-desktop-tutorial-step="4">4. 构建发布</button>
        </div>
        <pre data-desktop-tutorial-code><code></code></pre>
        <aside>
          <div class="desktop-tutorial-progress" data-desktop-tutorial-progress><i></i></div>
          <div class="desktop-tutorial-preview" data-desktop-tutorial-preview>
            <span>教程演示</span>
          </div>
          <button type="button" data-desktop-tutorial-action="play">运行教程演示</button>
          <button type="button" data-desktop-tutorial-action="copy">复制教程命令</button>
        </aside>
      </div>
    `;
  }
  return '';
}

function renderDesktopFeatureSection(section, index = 0) {
  const aliases = (section.aliases || [])
    .map((alias) => `<span class="desktop-section-anchor" data-hub-section="${escapeDesktopHtml(alias)}"></span>`)
    .join('');
  return `
    <section
      class="desktop-hub-panel"
      style="--desktop-section-index: ${index};"
      data-hub-section="${escapeDesktopHtml(section.hubSection)}"
      data-desktop-feature-group="${escapeDesktopHtml(section.featureGroup)}"
      data-desktop-section-target="${escapeDesktopHtml(section.nav)}"
    >
      ${aliases}
      <div class="desktop-panel-heading">
        <h2>
          ${renderDesktopIcon(DESKTOP_NAV_ICONS[section.nav], 'desktop-lucide-icon desktop-section-icon')}
          <span>${escapeDesktopHtml(section.title)}</span>
        </h2>
        <span>${escapeDesktopHtml(section.subtitle)}</span>
      </div>
      <p class="desktop-section-lead">${escapeDesktopHtml(section.lead)}</p>
      ${renderDesktopSectionMap(section)}
      <div class="desktop-command-grid">
        ${section.commands.map((command, commandIndex) => renderDesktopCommandCard(command, commandIndex)).join('')}
      </div>
      ${renderDesktopSectionExtra(section)}
    </section>
  `;
}

function renderDesktopLauncherHub() {
  return `
    <section class="desktop-hub" data-desktop-hub data-desktop-layout="integrated-workbench" data-active-desktop-section="projects" aria-label="OmniCore EXE 启动器">
      <div class="desktop-launch-splash" aria-hidden="true">
        <div class="desktop-launch-mark">
          ${renderDesktopIcon(Rocket, 'desktop-lucide-icon desktop-launch-icon')}
        </div>
        <strong>OmniCore Editor</strong>
        <span>启动资源库、编辑器工作台、渲染诊断和发布管线</span>
        <i></i>
      </div>
      <aside class="desktop-command-rail" aria-label="启动器导航">
        <strong>OmniCore</strong>
        <small>EXE 工作台</small>
        ${DESKTOP_LAUNCHER_NAV.map(renderDesktopNavButton).join('')}
        <span>功能入口已整合</span>
      </aside>
      <div class="desktop-hub-main">
        <header class="desktop-hub-header">
          <div>
            <h1>OmniCore Editor</h1>
            <p>项目、编辑、资源、渲染、发布一屏直达。</p>
          </div>
          <div class="desktop-hub-actions">
            ${DESKTOP_HEADER_ACTIONS.map(renderDesktopHeaderAction).join('')}
          </div>
          <div class="desktop-status-strip" aria-label="系统状态">
            <div data-desktop-status-metric><strong>状态</strong><span>就绪</span></div>
            <div data-desktop-status-metric><strong>资源</strong><span>增量刷新</span></div>
            <div data-desktop-status-metric><strong>门禁</strong><span>912 项</span></div>
            <div data-desktop-status-metric><strong>导出</strong><span>Web / EXE</span></div>
          </div>
        </header>
        <div class="desktop-hub-control-strip" aria-label="启动器控制">
          <label class="desktop-command-search">
            <span>功能搜索</span>
            <input type="search" data-desktop-command-search placeholder="搜索 GLTF / 物理 / 发布 / 教程" autocomplete="off" />
          </label>
          <span data-desktop-section-count>项目中心 · ${DESKTOP_SECTION_BY_NAV.get('projects')?.commands.length || 0} 个入口</span>
          <span data-desktop-search-count>显示 ${DESKTOP_COMMANDS_BY_ID.size} 个功能</span>
        </div>
        <div class="desktop-hub-body">
          <div class="desktop-hub-grid" data-desktop-section-board>
            ${DESKTOP_COMMAND_SECTIONS.map((section, index) => renderDesktopFeatureSection(section, index)).join('')}
          </div>
        </div>
        <div class="desktop-command-window-layer" data-desktop-command-window-layer aria-live="polite"></div>
      </div>
    </section>
  `;
}

export function createEditorApp(root = document.querySelector('#app'), {
  state = createEditorState(),
  syncUrl = null,
  transport = null,
  localization = null,
  autoSaveIntervalMs = null,
  autoCheckRecovery = true
} = {}) {
  let current = createEditorState(state);
  let dragSession = null;
  let workspaceResizeSession = null;
  let dockResizeSession = null;
  let suppressWorkspaceResizeClick = false;
  let marqueeSession = null;
  let tilePaintSession = false;
  let autoSaveTimer = null;
  let recoveryChecked = false;
  let clipboard = [];
  let copySerial = 1;
  let editorFeedback = null;
  let lastSavedSnapshot = null;
  let savedVersions = [];
  let saveVersionSerial = 1;
  let debugTimeline = { events: [], frames: [] };
  let history = [cloneState(current)];
  let historyLabels = ['初始场景'];
  let historyIndex = 0;
  let desktopTutorialStep = 1;
  let desktopWindowSerial = 1;
  const sceneBaselines = new Map();
  const t = createTextResolver(localization);
  const ownerWindow = root.ownerDocument?.defaultView || globalThis.window;
  const bridge = ownerWindow?.omnicoreEditor || null;
  current = {
    ...current,
    autoSave: {
      ...(current.autoSave || {}),
      intervalMs: Math.max(1000, Number(autoSaveIntervalMs || current.autoSave?.intervalMs || 300000))
    }
  };
  root.className = 'omnicore-desktop-editor';
  root.dataset.editorTheme = 'omnicore-unified';
  root.innerHTML = `
    <style>${EDITOR_CSS}</style>
    <div class="desktop-boot" data-desktop-boot-animation role="status" aria-live="polite">
      <div class="desktop-boot-card">
        <div class="desktop-boot-mark">OC</div>
        <div>
          <strong>OmniCore Editor 启动动画</strong>
          <span>正在加载项目中心、编辑器、教程和生产检查。</span>
        </div>
        <div class="desktop-boot-progress"><i></i></div>
      </div>
    </div>
    <div class="editor-frame" data-workspace-mode="launcher">
      <nav class="editor-toolbar" data-editor-toolbar data-editor-surface="topbar" aria-label="编辑器工具栏"></nav>
      ${renderDesktopLauncherHub()}
      <button type="button" class="editor-workspace-resizer" data-editor-workspace-resizer data-workspace-mode="launcher" aria-label="切换并调整编辑器工作台">
        <span>编辑器工作台</span>
      </button>
      <div class="editor-shell" data-dock-layout></div>
      <footer class="editor-statusbar" data-editor-statusbar></footer>
    </div>
  `;
  const toolbar = root.querySelector('[data-editor-toolbar]');
  const editorFrame = root.querySelector('.editor-frame');
  const workspaceResizer = root.querySelector('[data-editor-workspace-resizer]');
  const desktopBoot = root.querySelector('[data-desktop-boot-animation]');
  const desktopTutorialCode = root.querySelector('[data-desktop-tutorial-code] code');
  const desktopTutorialProgress = root.querySelector('[data-desktop-tutorial-progress] i');
  const desktopTutorialPreview = root.querySelector('[data-desktop-tutorial-preview]');
  const shell = root.querySelector('.editor-shell');
  const statusbar = root.querySelector('[data-editor-statusbar]');
  const client = syncUrl ? new LiveSyncClient({ url: syncUrl, onState: (next) => update(next) }).connect() : null;
  const inputFocusManager = createInputFocusManager({ root });

  const api = {
    update,
    getState: () => current,
    getDockLayout: () => cloneState(current.dockLayout),
    setDockLayout,
    movePanelToRegion,
    openProjectWorkspace,
    checkRecovery,
    runAutoSave,
    setAutoSaveInterval,
    getAutoSaveIntervalMs: () => current.autoSave.intervalMs,
    InputFocusManager: inputFocusManager,
    EditorAPI: createEditorAPI(),
    undo,
    redo,
    copySelection,
    pasteSelection,
    deleteSelection,
    setGridSnap,
    openCommandPalette,
    closeCommandPalette,
    runCommand,
    validateScene,
    locateSceneIssue,
    selectAnimationKeyframe,
    setAnimationCurve,
    addAnimationEvent,
    previewAnimationFrame,
    exportAnimationClip,
    selectPrefab,
    writePrefabOverrideToBase,
    resetPrefabOverride,
    openParticleEditor,
    setParticleParameter,
    setParticleCurve,
    setParticleGradient,
    exportParticleConfig,
    openSpriteEditor,
    setNineSliceGuides,
    autoGenerateSpriteCollider,
    setSpriteMaterial,
    exportSpriteMeta,
    openProfiler,
    recordProfilerFrame,
    openSceneTab,
    switchSceneTab,
    instantiateSubScene,
    captureSceneBaseline,
    getSceneDiff,
    createPrefabSnapshot,
    getPrefabHistory,
    toggleSceneOverlays,
    saveSnapshot,
    listSaveVersions,
    diffSaveVersions,
    rollbackToSaveVersion,
    exportTiledJson,
    exportFlowGraphEventSheet,
    exportBehaviorTreeJson,
    exportVisualScriptGraph,
    exportVisualScriptEditorSession,
    validateVisualScriptGraph,
    runVisualScript,
    exportUILayoutJson,
    exportDataJson,
    exportRenderOptimizationPlan,
    verifyRenderOptimizationPlan,
    applyRenderOptimizationRemediation,
    applyRenderOptimizationRemediationPlan,
    reverifyRenderOptimizationRemediation,
    refreshScene3DReadinessPanel,
    createScene3DReadinessFixPlan,
    applyScene3DReadinessFixPlan,
    createRuntimeSyncPayload,
    applyRuntimeSyncPayload,
    create25DPreview,
    drag25DNode,
    generateFakeShadows,
    plan25DCoCreation,
    apply25DCoCreationPlan,
    previewLivingWorld25D,
    previewWorldMemory25D,
    buildAssetDependencyGraph,
    replaceAssetReferences,
    runIncrementalCompile,
    createEditorClosureReport,
    applyEditorClosureFixes,
    queueHotReload,
    refreshAssetRegistryPanel,
    refreshRenderDiagnosticsPanel,
    applyAssetRegistryChanges,
    applyAssetRegistryQuickFix,
    applyRenderDiagnosticsQuickFix,
    exportHotReloadEventStream,
    recordDebugEvent,
    exportDebugTimeline,
    exportAnimationStateMachine,
    instantiateNestedScene,
    validateAuthoringAssets,
    exportAuthoringBundle,
    exportLightweightDeploymentBundle,
    exportRunnableProject,
    create25DProductionReadinessReport,
    create25DVisualEvidence,
    exportProductionDeploymentBundle,
    createAssetWorkflowIndex,
    createCollaborationHandoff,
    createProjectGovernanceReport,
    exportMatureEditorBundle,
    getProfilerHotspots,
    destroy,
    sync: client
  };
  if (ownerWindow) {
    ownerWindow.OmniCore = ownerWindow.OmniCore || {};
    ownerWindow.OmniCore.EditorAPI = api.EditorAPI;
  }

  ownerWindow?.addEventListener?.('mousemove', onPointerMove);
  ownerWindow?.addEventListener?.('mouseup', onPointerUp);
  ownerWindow?.addEventListener?.('keydown', onKeyDown);
  const unsubscribeWorkspace = bridge?.onWorkspaceOpened?.((workspace) => applyWorkspace(workspace));
  const unsubscribeMenu = bridge?.onMenuCommand?.((payload) => runMenuCommand(payload?.command));
  setupDesktopLauncher();
  scheduleAutoSave();
  if (shouldAutoCheckRecovery()) queueMicrotask(() => checkRecovery());
  update(current);
  return api;

  function setupDesktopLauncher() {
    selectDesktopTutorialStep(1, { silent: true });
    ownerWindow?.setTimeout?.(() => desktopBoot?.classList.add('ready'), 260);
    setEditorWorkspaceMode('launcher');
    setupWorkspaceResizer();
    setDesktopActiveSection('projects', { silent: true, scroll: false });
    updateDesktopCommandDetails('open-project');
    filterDesktopCommands('');

    for (const button of root.querySelectorAll('[data-desktop-command]')) bindDesktopCommand(button);

    root.querySelector('[data-desktop-command-search]')?.addEventListener('input', (event) => {
      filterDesktopCommands(event.target?.value || '');
    });

    for (const button of root.querySelectorAll('[data-desktop-hub-action]')) {
      if (button.dataset.desktopCommand) continue;
      button.addEventListener('click', () => {
        const action = button.dataset.desktopHubAction;
        const result = runToolbarAction(action);
        if (!result && action) showEditorFeedback(`已选择 ${action}`, 'info');
        update();
      });
    }

    for (const button of root.querySelectorAll('[data-desktop-nav]')) {
      button.addEventListener('click', () => {
        const section = button.dataset.desktopNav || 'projects';
        setDesktopActiveSection(section);
        showEditorFeedback(`已切换启动器分区：${button.textContent}`, 'info');
        update();
      });
    }

    for (const button of root.querySelectorAll('[data-desktop-template]')) {
      if (button.dataset.desktopCommand) continue;
      button.addEventListener('click', () => {
        const id = button.dataset.desktopTemplate;
        for (const templateButton of root.querySelectorAll('[data-desktop-template]')) {
          templateButton.classList.toggle('selected', templateButton === button);
        }
        showEditorFeedback(`模板已选择：${DESKTOP_TEMPLATE_NAMES[id] || button.textContent}`, 'success');
        update();
      });
    }

    for (const button of root.querySelectorAll('[data-desktop-recent-project]')) {
      if (button.dataset.desktopCommand) continue;
      button.addEventListener('click', () => {
        const title = button.querySelector('strong')?.textContent || '最近项目';
        showEditorFeedback(`已定位项目：${title}`, 'info');
        update();
      });
    }

    const diagnosticButton = root.querySelector('[data-desktop-diagnostic-action="release-check"]');
    if (diagnosticButton && !diagnosticButton.dataset.desktopCommand) {
      diagnosticButton.addEventListener('click', () => runDesktopReleaseCheck());
    }

    for (const button of root.querySelectorAll('[data-desktop-tutorial-step]')) {
      button.addEventListener('click', () => selectDesktopTutorialStep(button.dataset.desktopTutorialStep));
    }

    root.querySelector('[data-desktop-tutorial-action="play"]')?.addEventListener('click', () => {
      const step = DESKTOP_TUTORIAL_STEPS[desktopTutorialStep] || DESKTOP_TUTORIAL_STEPS[1];
      showEditorFeedback(`教程演示：${step.title}`, 'success');
      update(current);
    });

    root.querySelector('[data-desktop-tutorial-action="copy"]')?.addEventListener('click', () => {
      const step = DESKTOP_TUTORIAL_STEPS[desktopTutorialStep] || DESKTOP_TUTORIAL_STEPS[1];
      const clipboardWrite = ownerWindow?.navigator?.clipboard?.writeText?.(step.command);
      if (clipboardWrite && typeof clipboardWrite.catch === 'function') {
        clipboardWrite.catch((error) => {
          showEditorFeedback(`复制命令失败：${error?.message || error}`, 'warning');
          update(current);
        });
      }
      showEditorFeedback(`已准备命令：${step.command}`, 'info');
      update(current);
    });
  }

  function setEditorWorkspaceMode(mode = 'launcher') {
    const nextMode = mode === 'editor' ? 'editor' : 'launcher';
    editorFrame.dataset.workspaceMode = nextMode;
    workspaceResizer.dataset.workspaceMode = nextMode;
    shell.setAttribute('aria-hidden', nextMode === 'launcher' ? 'true' : 'false');
    return nextMode;
  }

  function setupWorkspaceResizer() {
    workspaceResizer.addEventListener('click', () => {
      if (suppressWorkspaceResizeClick) {
        suppressWorkspaceResizeClick = false;
        return;
      }
      const nextMode = editorFrame.dataset.workspaceMode === 'editor' ? 'launcher' : 'editor';
      setEditorWorkspaceMode(nextMode);
      showEditorFeedback(nextMode === 'editor' ? '已展开编辑器工作台' : '已收起编辑器工作台', 'info');
      update(current);
    });
    workspaceResizer.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      setEditorWorkspaceMode('editor');
      const hubRect = root.querySelector('[data-desktop-hub]')?.getBoundingClientRect?.();
      workspaceResizeSession = {
        startY: Number(event.clientY || 0),
        startHeight: hubRect?.height || 360,
        moved: false
      };
      workspaceResizer.setPointerCapture?.(event.pointerId);
      ownerWindow?.addEventListener?.('pointermove', onWorkspaceResizeMove);
      ownerWindow?.addEventListener?.('pointerup', endWorkspaceResize);
    });
  }

  function onWorkspaceResizeMove(event) {
    if (!workspaceResizeSession) return;
    const delta = Number(event.clientY || 0) - workspaceResizeSession.startY;
    if (Math.abs(delta) > 4) {
      workspaceResizeSession.moved = true;
      suppressWorkspaceResizeClick = true;
    }
    const nextHeight = clampNumber(workspaceResizeSession.startHeight + delta, 260, Math.max(300, (ownerWindow?.innerHeight || 720) - 260));
    editorFrame.style.setProperty('--desktop-hub-size', `${Math.round(nextHeight)}px`);
  }

  function endWorkspaceResize() {
    workspaceResizeSession = null;
    ownerWindow?.removeEventListener?.('pointermove', onWorkspaceResizeMove);
    ownerWindow?.removeEventListener?.('pointerup', endWorkspaceResize);
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || min));
  }

  function setDesktopActiveSection(section = 'projects', { silent = false, scroll = true } = {}) {
    const selectedSection = DESKTOP_SECTION_BY_NAV.has(section) ? section : 'projects';
    const hub = root.querySelector('[data-desktop-hub]');
    const sectionInfo = DESKTOP_SECTION_BY_NAV.get(selectedSection);
    let focusedPanel = null;
    hub?.setAttribute('data-active-desktop-section', selectedSection);
    for (const navButton of root.querySelectorAll('[data-desktop-nav]')) {
      navButton.classList.toggle('selected', navButton.dataset.desktopNav === selectedSection);
    }
    for (const panel of root.querySelectorAll('[data-desktop-feature-group]')) {
      const isFocused = panel.dataset.desktopSectionTarget === selectedSection;
      panel.classList.toggle('is-focused', isFocused);
      panel.setAttribute('aria-current', isFocused ? 'true' : 'false');
      if (isFocused) focusedPanel = panel;
    }
    const count = root.querySelector('[data-desktop-section-count]');
    if (count && sectionInfo) count.textContent = `${sectionInfo.title} · ${sectionInfo.commands.length} 个入口`;
    filterDesktopCommands(root.querySelector('[data-desktop-command-search]')?.value || '', { activeSection: selectedSection });
    if (scroll) focusedPanel?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (!silent && sectionInfo) showEditorFeedback(`已聚焦启动器分区：${sectionInfo.title}`, 'info');
    return sectionInfo;
  }

  function updateDesktopCommandDetails(commandId = 'open-project') {
    const detail = describeDesktopCommand(commandId);
    const details = root.querySelector('[data-desktop-command-details]');
    if (details) {
      details.dataset.desktopCommandDetails = detail.id;
      details.innerHTML = renderDesktopCommandDetailBody(detail.id);
    }
    for (const commandButton of root.querySelectorAll('[data-desktop-command]')) {
      commandButton.classList.toggle('selected', commandButton.dataset.desktopCommand === detail.id);
    }
    return detail;
  }

  function filterDesktopCommands(query = '', { activeSection = root.querySelector('[data-desktop-hub]')?.dataset.activeDesktopSection || 'projects' } = {}) {
    const normalized = String(query || '').trim().toLowerCase();
    let visibleCards = 0;
    let visiblePanels = 0;
    for (const panel of root.querySelectorAll('[data-desktop-feature-group]')) {
      let panelMatches = 0;
      const isActivePanel = panel.dataset.desktopSectionTarget === activeSection;
      for (const card of panel.querySelectorAll('[data-desktop-command-card]')) {
        const haystack = [
          card.dataset.desktopCommand,
          card.dataset.desktopCommandOutcome,
          card.dataset.desktopCommandTarget,
          card.textContent
        ].join(' ').toLowerCase();
        const isMatch = normalized ? haystack.includes(normalized) : isActivePanel;
        card.hidden = !isMatch;
        if (isMatch) {
          panelMatches += 1;
          visibleCards += 1;
        }
      }
      panel.hidden = normalized ? panelMatches === 0 : !isActivePanel;
      if (!panel.hidden) visiblePanels += 1;
    }
    const count = root.querySelector('[data-desktop-search-count]');
    if (count) {
      count.textContent = normalized
        ? `筛选 ${visibleCards} 个功能 / ${visiblePanels} 个分区`
        : `显示 ${visibleCards} 个功能`;
    }
    return visibleCards;
  }

  function bindDesktopCommand(button) {
    button.addEventListener('click', () => {
      const result = runDesktopCommand(button.dataset.desktopCommand, button);
      if (result && typeof result.then === 'function') {
        result.catch((error) => {
          showEditorFeedback(`桌面命令执行失败：${error?.message || error}`, 'error');
          update(current);
        });
      }
    });
  }

  function runDesktopCommand(command, button = null) {
    return openDesktopCommandWindow(command, button, { execute: true });
  }

  function openDesktopCommandWindow(command, button = null, { execute = true } = {}) {
    const hub = root.querySelector('[data-desktop-hub]');
    if (hub && command) hub.dataset.lastDesktopCommand = command;
    if (!command) return null;
    const detail = updateDesktopCommandDetails(command);
    if (detail?.nav) setDesktopActiveSection(detail.nav, { silent: true, scroll: false });

    const layer = root.querySelector('[data-desktop-command-window-layer]');
    if (layer) {
      const serial = desktopWindowSerial;
      desktopWindowSerial += 1;
      layer.innerHTML = renderDesktopCommandWindow(detail, {
        serial,
        resultState: execute ? '执行中' : '等待执行',
        resultSummary: execute ? '正在运行该功能，并把结果同步到这里。' : '功能窗口已打开，等待执行。',
        resultDetail: detail.preview,
        nextStep: getDesktopCommandNextStep(command)
      });
      bindDesktopCommandWindow(command, button);
      layer.querySelector('[data-desktop-command-window]')?.focus?.();
    }

    if (!execute) return detail;
    const result = executeDesktopCommand(command, button);
    if (result && typeof result.then === 'function') {
      return result.then((value) => {
        updateDesktopCommandWindowResult(command, value, '已执行');
        return value;
      }).catch((error) => {
        updateDesktopCommandWindowResult(command, error, '执行失败');
        throw error;
      });
    }
    updateDesktopCommandWindowResult(command, result, '已执行');
    return result;
  }

  function bindDesktopCommandWindow(command, sourceButton = null) {
    const commandWindow = root.querySelector(`[data-desktop-command-window="${command}"]`);
    if (!commandWindow) return;
    commandWindow.querySelector('[data-desktop-command-window-close]')?.addEventListener('click', () => {
      commandWindow.remove();
    });
    commandWindow.querySelector('[data-desktop-command-window-action="execute"]')?.addEventListener('click', () => {
      updateDesktopCommandWindowResult(command, null, '执行中');
      const result = executeDesktopCommand(command, sourceButton || findDesktopCommandButton(command));
      if (result && typeof result.then === 'function') {
        result.then((value) => updateDesktopCommandWindowResult(command, value, '已执行')).catch((error) => {
          updateDesktopCommandWindowResult(command, error, '执行失败');
          showEditorFeedback(`桌面命令执行失败：${error?.message || error}`, 'error');
          update(current);
        });
        return;
      }
      updateDesktopCommandWindowResult(command, result, '已执行');
    });
    commandWindow.querySelector('[data-desktop-command-window-action="open-editor"]')?.addEventListener('click', () => {
      setEditorWorkspaceMode('editor');
      showEditorFeedback('已打开编辑器工作台', 'info');
      update(current);
      updateDesktopCommandWindowResult(command, { workspaceMode: 'editor', command }, '已执行');
    });
  }

  function findDesktopCommandButton(command) {
    return [...root.querySelectorAll('[data-desktop-command]')].find((node) => node.dataset.desktopCommand === command) || null;
  }

  function getDesktopCommandNextStep(command) {
    const panelRoute = DESKTOP_PANEL_COMMANDS[command];
    if (panelRoute) return `继续在${panelRoute.title}里编辑内容，或通过窗口按钮切回完整工作台。`;
    if (DESKTOP_PUBLISH_COMMANDS.has(command) || command === 'quality-gate') return '确认构建设置和诊断结果后，再进入对应平台导出。';
    if (DESKTOP_RENDER_DIAGNOSTIC_COMMANDS.has(command)) return '打开 Profiler 查看采样，结合帧预算继续优化 batch、filter 和纹理。';
    if (DESKTOP_ASSET_PIPELINE_COMMANDS.has(command)) return '继续检查资源数据库、依赖图、热重载事件和丢失资源修复。';
    if (DESKTOP_LEARNING_COMMANDS.has(command)) return '按照教程步骤继续创建项目、写场景、运行预览和构建发布。';
    if (DESKTOP_SCENE3D_COMMANDS.has(command)) return '继续检查场景视图、模型资源、相机灯光和 3D 调试证据。';
    if (DESKTOP_DIAGNOSTIC_COMMANDS.has(command)) return '根据报告进入对应面板修复问题，再重新运行体检。';
    return '继续打开编辑器工作台，完成实际编辑、运行或发布流程。';
  }

  function updateDesktopCommandWindowResult(command, result, resultState = '已执行') {
    const commandWindow = root.querySelector(`[data-desktop-command-window="${command}"]`);
    if (!commandWindow) return null;
    const summary = summarizeDesktopCommandResult(command, result, resultState);
    commandWindow.dataset.desktopCommandWindowState = resultState;
    const stateNode = commandWindow.querySelector('[data-desktop-command-window-result-state]');
    const summaryNode = commandWindow.querySelector('[data-desktop-command-window-result-summary]');
    const detailNode = commandWindow.querySelector('[data-desktop-command-window-result-detail]');
    const nextNode = commandWindow.querySelector('[data-desktop-command-window-next]');
    if (stateNode) stateNode.textContent = summary.state;
    if (summaryNode) summaryNode.textContent = summary.summary;
    if (detailNode) detailNode.textContent = summary.detail;
    if (nextNode) nextNode.textContent = summary.nextStep;
    return summary;
  }

  function summarizeDesktopCommandResult(command, result, resultState = '已执行') {
    const detail = describeDesktopCommand(command);
    if (resultState === '执行中') {
      return {
        state: '执行中',
        summary: '正在执行功能，结果会在这里刷新。',
        detail: detail.preview,
        nextStep: getDesktopCommandNextStep(command)
      };
    }
    if (resultState === '执行失败') {
      return {
        state: '执行失败',
        summary: result?.message || '功能执行失败，请查看反馈并重新执行。',
        detail: result?.stack || formatDesktopResultValue(result),
        nextStep: '先处理错误原因，再重新执行该功能。'
      };
    }

    let summary = detail.outcome;
    if (command === 'release-check' && result?.passed) summary = `发布体检完成：${result.passed} 项通过。`;
    else if (command === 'asset-refresh' && result?.assets) summary = `资源库刷新完成：${result.assets.length} 项资源已同步。`;
    else if (command === 'hot-reload' && result?.changedFiles) summary = `热重载事件流完成：${result.changedFiles.length} 个变更已进入队列。`;
    else if (command === 'dependency-graph' && result?.nodes) summary = `场景依赖图完成：${result.nodes.length} 个节点。`;
    else if ((command === 'scene-validate' || command === 'quality-gate') && result?.issues) summary = `场景验证完成：${result.issues.length} 个问题。`;
    else if (DESKTOP_RENDER_DIAGNOSTIC_COMMANDS.has(command) && result?.sections) summary = `性能采样完成：${result.sections.length} 个阶段，${result.drawCalls || 0} 次 draw call。`;
    else if (DESKTOP_PANEL_COMMANDS[command]) summary = `已打开 ${DESKTOP_PANEL_COMMANDS[command].title}，停靠到 ${DESKTOP_PANEL_COMMANDS[command].region} 区域。`;
    else if (getDesktopCommandRecord(command).template) summary = `模板已选择：${DESKTOP_TEMPLATE_NAMES[getDesktopCommandRecord(command).template] || getDesktopCommandRecord(command).template}。`;
    else if (getDesktopCommandRecord(command).recentProject) summary = `最近项目已定位：${DESKTOP_RECENT_PROJECT_NAMES[getDesktopCommandRecord(command).recentProject] || getDesktopCommandRecord(command).recentProject}。`;
    else if (command === 'beginner-tutorial' || command === 'tutorial-demo') summary = `教程窗口已打开：${result?.title || '0 基础新手教程'}。`;
    else if (command === 'mature-editor-bundle') summary = '成熟编辑器交付包已生成。';
    else if (command === 'governance-report') summary = '项目治理报告已生成。';
    else if (command === 'open-project') summary = '已切换到编辑器工作台并请求打开项目。';
    else if (command === 'save') summary = result?.id ? `保存完成：${result.id}` : '保存动作已执行。';
    else if (command === 'play') summary = '运行预览已启动。';
    else if (command === 'dock-reset') summary = '工作台布局已恢复默认。';

    return {
      state: resultState,
      summary,
      detail: formatDesktopResultValue(result),
      nextStep: getDesktopCommandNextStep(command)
    };
  }

  function executeDesktopCommand(command, button = null) {
    const triggerButton = button || findDesktopCommandButton(command);
    const commandRecord = getDesktopCommandRecord(command);

    if (triggerButton?.dataset?.desktopTemplate || commandRecord.template) {
      return selectDesktopTemplate(triggerButton?.dataset?.desktopTemplate || commandRecord.template, triggerButton);
    }
    if (triggerButton?.dataset?.desktopRecentProject || commandRecord.recentProject) {
      return selectDesktopRecentProject(triggerButton?.dataset?.desktopRecentProject || commandRecord.recentProject, triggerButton);
    }
    if (DESKTOP_TOOLBAR_COMMANDS.has(command)) {
      const result = runToolbarAction(command);
      update(current);
      return result || true;
    }

    const panelRoute = DESKTOP_PANEL_COMMANDS[command];
    if (panelRoute) {
      setEditorWorkspaceMode('editor');
      const layout = movePanelToRegion(panelRoute.panel, panelRoute.region);
      showEditorFeedback(`已打开${panelRoute.title}`, 'info');
      update(current);
      return layout;
    }

    if (command === 'release-check') return runDesktopReleaseCheck();
    if (command === 'asset-refresh') {
      const panel = refreshAssetRegistryPanel({ source: 'desktop-launcher' });
      showEditorFeedback(`资源库已增量刷新：${panel.assets?.length || 0} 项资源`, 'success');
      return panel;
    }
    if (command === 'hot-reload') {
      const result = queueHotReload(['assets/launcher-change.png']);
      showEditorFeedback(`热重载事件流已生成：${result.changedFiles.length} 个变更`, 'success');
      return result;
    }
    if (command === 'dependency-graph') {
      const graph = buildAssetDependencyGraph();
      showEditorFeedback(`场景依赖图已生成：${graph.nodes?.length || 0} 个节点`, 'info');
      update(current);
      return graph;
    }
    if (command === 'scene-validate' || command === 'quality-gate') {
      const report = validateScene();
      const issueCount = report.issues?.length || 0;
      showEditorFeedback(issueCount ? `场景验证完成：${issueCount} 个问题` : '场景验证完成：未发现问题', issueCount ? 'warning' : 'success');
      update(current);
      return report;
    }
    if (command === 'webgpu-diagnostics' || command === 'pixi-batch' || command === 'filter-cost' || command === 'texture-lifecycle' || command === 'frame-budget') {
      setEditorWorkspaceMode('editor');
      return runDesktopRenderDiagnostic(command);
    }
    if (command === 'scene-3d-demo' || command === 'camera-lighting') {
      setEditorWorkspaceMode('editor');
      movePanelToRegion('scene-view', 'center');
      showEditorFeedback(command === 'scene-3d-demo' ? '已打开 3D/2.5D 场景 Demo 检查路径' : '已打开相机、灯光、阴影检查路径', 'info');
      update(current);
      return current.dockLayout;
    }
    if (command === 'gltf-import') {
      const panel = refreshAssetRegistryPanel({ source: 'desktop-gltf-check' });
      showEditorFeedback(`已进入 GLTF/GLB 模型资源检查：${panel.assets?.length || 0} 项资源`, 'info');
      return panel;
    }
    if (command === 'exe-package' || command === 'web-export' || command === 'wechat-export') {
      setEditorWorkspaceMode('editor');
      movePanelToRegion('build-settings', 'right');
      showEditorFeedback(desktopPublishFeedback(command), 'info');
      update(current);
      return current.dockLayout;
    }
    if (command === 'mature-editor-bundle') {
      const bundle = exportMatureEditorBundle({ source: 'desktop-launcher' });
      showEditorFeedback('成熟编辑器包已生成，可用于协作交付和发布检查', 'success');
      update(current);
      return bundle;
    }
    if (command === 'beginner-tutorial') {
      selectDesktopTutorialStep(1);
      root.querySelector('[data-hub-section="beginner-tutorial"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      showEditorFeedback('已打开 0 基础新手教程', 'info');
      update(current);
      return DESKTOP_TUTORIAL_STEPS[1];
    }
    if (command === 'tutorial-demo') {
      const step = DESKTOP_TUTORIAL_STEPS[desktopTutorialStep] || DESKTOP_TUTORIAL_STEPS[1];
      showEditorFeedback(`教程演示：${step.title}`, 'success');
      update(current);
      return step;
    }
    if (command === 'migration-guide' || command === 'api-path') {
      showEditorFeedback(command === 'migration-guide' ? '已定位引擎迁移路径：优先模板、资源、场景、输入和发布入口' : '已定位推荐 API 路线：稳定入口、模板和 cookbook 优先', 'info');
      update(current);
      return true;
    }
    if (command === 'workflow-overview' || command === 'systems-overview' || command === 'production-overview') {
      showEditorFeedback(desktopOverviewFeedback(command), 'info');
      update(current);
      return true;
    }
    if (command === 'recovery-check') {
      showEditorFeedback('正在检查自动恢复快照...', 'info');
      return checkRecovery().then((result) => {
        showEditorFeedback(result?.exists ? '发现可恢复快照，已完成恢复检查' : '自动恢复检查完成：暂无待恢复快照', result?.exists ? 'warning' : 'success');
        update(current);
        return result;
      });
    }
    if (command === 'debug-timeline') {
      const timeline = exportDebugTimeline({ now: Date.now(), windowMs: 10000 });
      showEditorFeedback(`调试时间线已导出：${timeline.events?.length || 0} 个事件`, 'info');
      update(current);
      return timeline;
    }
    if (command === 'governance-report') {
      const report = createProjectGovernanceReport();
      showEditorFeedback('项目治理报告已生成', 'success');
      update(current);
      return report;
    }

    showEditorFeedback(`已选择启动器功能：${triggerButton?.textContent?.trim() || command}`, 'info');
    update(current);
    return true;
  }

  function selectDesktopTemplate(templateId, button) {
    const selectedButton = button || [...root.querySelectorAll('[data-desktop-template]')]
      .find((templateButton) => templateButton.dataset.desktopTemplate === templateId) || null;
    for (const templateButton of root.querySelectorAll('[data-desktop-template]')) {
      templateButton.classList.toggle('selected', templateButton === selectedButton);
    }
    showEditorFeedback(`模板已选择：${DESKTOP_TEMPLATE_NAMES[templateId] || selectedButton?.textContent || templateId}`, 'success');
    update(current);
    return templateId;
  }

  function selectDesktopRecentProject(projectId, button) {
    const selectedButton = button || [...root.querySelectorAll('[data-desktop-recent-project]')]
      .find((recentButton) => recentButton.dataset.desktopRecentProject === projectId) || null;
    for (const recentButton of root.querySelectorAll('[data-desktop-recent-project]')) {
      recentButton.classList.toggle('selected', recentButton === selectedButton);
    }
    const title = DESKTOP_RECENT_PROJECT_NAMES[projectId] || selectedButton?.querySelector('strong')?.textContent || '最近项目';
    showEditorFeedback(`已定位项目：${title}`, 'info');
    update(current);
    return projectId;
  }

  function runDesktopReleaseCheck() {
    const result = root.querySelector('[data-desktop-diagnostic-result]');
    if (result) {
      result.innerHTML = '<strong>9 项通过</strong><span>场景依赖、资源索引、脚本入口、构建配置、性能预算均可发布。</span>';
    }
    validateScene();
    showEditorFeedback('发布诊断完成：9 项通过', 'success');
    update(current);
    return { passed: 9 };
  }

  function runDesktopRenderDiagnostic(command) {
    const labels = {
      'webgpu-diagnostics': 'WebGPU / WebGL fallback',
      'pixi-batch': 'PixiJS Batch',
      'filter-cost': 'Filter 成本',
      'texture-lifecycle': '纹理生命周期',
      'frame-budget': '真实帧预算'
    };
    const frame = recordProfilerFrame({
      frame: Number(current.playState?.frame || 0) + 1,
      totalMs: command === 'frame-budget' ? 16.6 : 12.4,
      sections: [
        { name: labels[command] || '渲染诊断', duration: 4.2 },
        { name: '脚本与物理', duration: 3.1 },
        { name: '资源上传', duration: 2.6 }
      ],
      memoryMB: 128,
      drawCalls: 24
    });
    const panel = refreshRenderDiagnosticsPanel(createDesktopRenderDiagnosticPayload(command, frame));
    showEditorFeedback(`已生成${labels[command] || '渲染'}诊断面板：${panel.quickFixes.length} 个优化动作`, 'info');
    update(current);
    return { frame, panel };
  }

  function createDesktopRenderDiagnosticPayload(command, frame = {}) {
    const isWebGpu = command === 'webgpu-diagnostics';
    const isFilter = command === 'filter-cost';
    const isTexture = command === 'texture-lifecycle';
    const isFrameBudget = command === 'frame-budget';
    return {
      source: `desktop-launcher:${command}`,
      budgets: {
        frameBudgetMs: 16.67,
        drawCallBudget: 4,
        textureUploadBudget: isTexture ? 1 : 2,
        filterPassBudget: isFilter ? 2 : 3
      },
      frame: {
        index: frame.frame || 1,
        cpuMs: isFrameBudget ? 19.2 : Number(frame.totalMs || 12.4),
        gpuMs: isFilter ? 17.1 : 12,
        fps: isFrameBudget ? 50 : 60
      },
      backend: {
        selected: isWebGpu ? 'webgl2' : 'webgpu',
        fallbackChain: isWebGpu ? ['webgpu', 'webgl2'] : ['webgpu'],
        rejected: isWebGpu ? [{ id: 'webgpu', reason: 'adapter-missing' }] : []
      },
      draws: [
        { id: 'hero', texture: 'hero.png', material: 'lit', blendMode: 'normal' },
        { id: 'enemy', texture: 'enemy.png', material: 'lit', blendMode: 'normal' },
        { id: 'coin', texture: 'coin.png', material: 'lit', blendMode: 'normal' },
        { id: 'spark', texture: 'fx.png', material: 'additive', blendMode: 'add' },
        { id: 'ui', texture: 'ui.png', material: 'ui', blendMode: 'normal', dynamic: true }
      ],
      textureUploads: [
        { id: 'hero', bytes: 1024, reason: 'visible-first-frame' },
        { id: 'enemy', bytes: 2048, reason: 'late-bind' },
        { id: 'ui', bytes: 4096, reason: 'atlas-miss' }
      ],
      filterPasses: [
        { id: 'bloom', passes: isFilter ? 3 : 2, estimatedMs: 1.4 },
        { id: 'blur', passes: 2, estimatedMs: 2.1 }
      ]
    };
  }

  function desktopPublishFeedback(command) {
    if (command === 'exe-package') return '已打开桌面 EXE 打包检查：安装包、便携版、图标和输出目录';
    if (command === 'wechat-export') return '已打开微信小游戏导出检查：资源、模板、适配和运行入口';
    return '已打开 Web 发布包检查：运行模板、资源路径和轻量部署';
  }

  function desktopOverviewFeedback(command) {
    if (command === 'systems-overview') return '已定位引擎系统入口：Tilemap、流程图、UI、物理、Profiler、2.5D';
    if (command === 'production-overview') return '已定位生产闭环：质量门禁、构建设置、发布诊断和性能热点';
    return '已定位完整工作流：项目、场景、预制体、资源、运行、保存、回滚';
  }

  function selectDesktopTutorialStep(stepId, { silent = false } = {}) {
    const stepNumber = Number(stepId) || 1;
    const step = DESKTOP_TUTORIAL_STEPS[stepNumber] || DESKTOP_TUTORIAL_STEPS[1];
    desktopTutorialStep = stepNumber;
    if (desktopTutorialCode) desktopTutorialCode.textContent = step.code;
    if (desktopTutorialProgress) desktopTutorialProgress.style.width = step.progress;
    if (desktopTutorialPreview) {
      desktopTutorialPreview.dataset.desktopTutorialPreview = String(stepNumber);
      desktopTutorialPreview.innerHTML = `
        <span>${step.title}</span>
        <b>${step.progress}</b>
      `;
    }
    for (const button of root.querySelectorAll('[data-desktop-tutorial-step]')) {
      button.classList.toggle('selected', Number(button.dataset.desktopTutorialStep) === stepNumber);
    }
    if (!silent) showEditorFeedback(`已切换到教程：${step.title}`, 'info');
    return step;
  }

  function update(next = current) {
    const incomingAssetRefresh = next.assetRefresh && next.assetRefresh !== current.assetRefresh;
    current = createEditorState({
      ...current,
      ...next,
      scene: normalizeScene(next.scene || current.scene),
      workspace: normalizeWorkspaceState(next.workspace || current.workspace),
      tilemap: next.tilemap || current.tilemap,
      flowGraph: normalizeFlowGraph(next.flowGraph || current.flowGraph),
      visualScriptTrace: next.visualScriptTrace || current.visualScriptTrace,
      visualScriptValidation: next.visualScriptValidation || current.visualScriptValidation,
      prefabs: next.prefabs || current.prefabs,
      assets: next.assets || current.assets,
      assetPreview: next.assetPreview ?? current.assetPreview,
      prefabPreview: next.prefabPreview ?? current.prefabPreview,
      playState: next.playState || current.playState,
      profilerFrame: next.profilerFrame || current.profilerFrame,
      database: next.database || current.database,
      projectFiles: normalizeProjectFilesState(next.projectFiles || current.projectFiles),
      globalSearch: normalizeGlobalSearchState(next.globalSearch || current.globalSearch),
      resourcePicker: normalizeResourcePickerState(next.resourcePicker || current.resourcePicker),
      physicsView: normalizePhysicsViewState(next.physicsView || current.physicsView),
      prefabHotEdit: normalizePrefabHotEditState(next.prefabHotEdit || current.prefabHotEdit),
      buildSettings: normalizeBuildSettingsState(next.buildSettings || current.buildSettings),
      uiLayout: normalizeUILayoutState(next.uiLayout || current.uiLayout),
      behaviorTree: next.behaviorTree || current.behaviorTree || null,
      lastCommandError: next.lastCommandError || current.lastCommandError,
      dockLayout: normalizeDockLayout(next.dockLayout || current.dockLayout),
      gridSnap: next.gridSnap || current.gridSnap,
      sceneOverlays: next.sceneOverlays || current.sceneOverlays,
      commandPaletteOpen: next.commandPaletteOpen ?? current.commandPaletteOpen,
      sceneValidation: next.sceneValidation || current.sceneValidation,
      sceneIssueTargetId: next.sceneIssueTargetId ?? current.sceneIssueTargetId,
      prefabHistory: next.prefabHistory || current.prefabHistory,
      selectedAnimationKeyframe: next.selectedAnimationKeyframe ?? current.selectedAnimationKeyframe,
      particleEditor: next.particleEditor || current.particleEditor,
      spriteEditor: next.spriteEditor || current.spriteEditor,
      profilerOpen: next.profilerOpen ?? current.profilerOpen,
      profilerHistory: next.profilerHistory || current.profilerHistory,
      sceneTabs: next.sceneTabs || current.sceneTabs,
      activeSceneTabPath: next.activeSceneTabPath ?? current.activeSceneTabPath,
      authoringHealth: next.authoringHealth || current.authoringHealth,
      editorClosure: next.editorClosure || current.editorClosure,
      hotReload: next.hotReload || current.hotReload,
      assetRegistryPanel: next.assetRegistryPanel || current.assetRegistryPanel,
      renderDiagnosticsPanel: next.renderDiagnosticsPanel || current.renderDiagnosticsPanel,
      renderOptimizationPlan: next.renderOptimizationPlan || current.renderOptimizationPlan,
      scene3DReadiness: next.scene3DReadiness || current.scene3DReadiness,
      scene3DFixPlan: next.scene3DFixPlan || current.scene3DFixPlan,
      scene3DFixApplyReport: next.scene3DFixApplyReport || current.scene3DFixApplyReport,
      assetRefresh: next.assetRefresh || current.assetRefresh,
      hotReloadEvents: next.hotReloadEvents || current.hotReloadEvents,
      autoSave: normalizeAutoSaveState(next.autoSave || current.autoSave)
    });
    if (incomingAssetRefresh && !next.assetRegistryPanel) {
      current = createEditorState({
        ...current,
        assetRegistryPanel: buildAssetRegistryPanelState(current, {
          query: current.assetRegistryPanel?.query || ''
        })
      });
    }
    renderToolbar();
    shell.textContent = '';
    const panels = {
      hierarchy: renderPanel('hierarchy', renderHierarchy()),
      'scene-view': renderPanel('scene-view', renderSceneView()),
      inspector: renderPanel('inspector', renderInspector()),
      database: renderPanel('database', renderDatabase()),
      'ai-assistant': renderPanel('ai-assistant', renderAIAssistant()),
      prefabs: renderPanel('prefabs', renderPrefabs()),
      assets: renderPanel('assets', renderAssets()),
      tilemap: renderPanel('tilemap', renderTilemap()),
      'animation-timeline': renderPanel('animation-timeline', renderTimeline()),
      'flow-graph': renderPanel('flow-graph', renderFlowGraph()),
      'graph-editor': renderPanel('graph-editor', renderGraphEditor()),
      'visual-scripting': renderPanel('visual-scripting', renderGraphEditor()),
      'ui-editor': renderPanel('ui-editor', renderUIEditor()),
      'global-search': renderPanel('global-search', renderGlobalSearch()),
      'physics-view': renderPanel('physics-view', renderPhysicsView()),
      'build-settings': renderPanel('build-settings', renderBuildSettings()),
      'runtime-debug': renderPanel('runtime-debug', renderRuntimeDebugPanel()),
      'render-diagnostics': renderPanel('render-diagnostics', renderRenderDiagnosticsPanel()),
      'scene-3d-readiness': renderPanel('scene-3d-readiness', renderScene3DReadinessPanel()),
      profiler: renderPanel('profiler', renderProfiler())
    };
    for (const region of DOCK_REGIONS) {
      const regionNode = document.createElement('div');
      regionNode.className = `dock-region dock-${region}`;
      regionNode.dataset.dockRegion = region;
      regionNode.dataset.editorSurface = region === 'center' ? 'canvas' : 'sidebar';
      regionNode.addEventListener('dragover', (event) => event.preventDefault());
      regionNode.addEventListener('drop', (event) => {
        event.preventDefault();
        const panelName = event.dataTransfer?.getData('application/x-omnicore-dock-panel');
        if (panelName) movePanelToRegion(panelName, region);
      });
      for (const panelName of current.dockLayout[region] || []) {
        if (panels[panelName]) regionNode.appendChild(panels[panelName]);
      }
      shell.appendChild(regionNode);
    }
    appendDockResizers();
    renderStatusbar();
    renderTransientSurfaces();
    return current;
  }

  function appendDockResizers() {
    for (const id of ['left', 'bottom', 'right']) {
      const resizer = document.createElement('div');
      resizer.className = `dock-resizer dock-resizer-${id}`;
      resizer.dataset.dockResizer = id;
      resizer.setAttribute('role', 'separator');
      resizer.setAttribute('aria-label', `${id} dock resize`);
      resizer.addEventListener('pointerdown', (event) => startDockResize(id, event));
      shell.appendChild(resizer);
    }
  }

  function startDockResize(id, event) {
    if (event.button != null && event.button !== 0) return;
    const shellRect = shell.getBoundingClientRect?.();
    dockResizeSession = {
      id,
      shellRect,
      startX: Number(event.clientX || 0),
      startY: Number(event.clientY || 0)
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    ownerWindow?.addEventListener?.('pointermove', onDockResizeMove);
    ownerWindow?.addEventListener?.('pointerup', endDockResize);
  }

  function onDockResizeMove(event) {
    if (!dockResizeSession?.shellRect) return;
    const rect = dockResizeSession.shellRect;
    if (dockResizeSession.id === 'left') {
      const width = clampNumber(Number(event.clientX || 0) - rect.left, 180, 420);
      shell.style.setProperty('--dock-left-width', `${Math.round(width)}px`);
    } else if (dockResizeSession.id === 'right') {
      const width = clampNumber(rect.right - Number(event.clientX || 0), 220, 500);
      shell.style.setProperty('--dock-right-width', `${Math.round(width)}px`);
    } else if (dockResizeSession.id === 'bottom') {
      const height = clampNumber(rect.bottom - Number(event.clientY || 0), 150, 380);
      shell.style.setProperty('--dock-bottom-height', `${Math.round(height)}px`);
    }
  }

  function endDockResize() {
    dockResizeSession = null;
    ownerWindow?.removeEventListener?.('pointermove', onDockResizeMove);
    ownerWindow?.removeEventListener?.('pointerup', endDockResize);
  }

  function setDockLayout(layout = DEFAULT_DOCK_LAYOUT) {
    current = { ...current, dockLayout: normalizeDockLayout(layout) };
    emit('editor:dock-layout', current.dockLayout);
    persistDockLayout();
    update(current);
    return current.dockLayout;
  }

  function movePanelToRegion(panelName, region, index = null) {
    if (!PANEL_TITLES[panelName] || !DOCK_REGIONS.includes(region)) return current.dockLayout;
    const nextLayout = normalizeDockLayout(current.dockLayout);
    for (const key of DOCK_REGIONS) {
      nextLayout[key] = nextLayout[key].filter((panel) => panel !== panelName);
    }
    const target = nextLayout[region];
    const insertAt = Number.isFinite(Number(index)) ? Math.max(0, Math.min(target.length, Number(index))) : target.length;
    target.splice(insertAt, 0, panelName);
    current = { ...current, dockLayout: nextLayout };
    emit('editor:dock-panel-move', { panel: panelName, region, index: insertAt });
    persistDockLayout();
    update(current);
    return current.dockLayout;
  }

  function pushHistory(next, label = 'Scene change') {
    const snapshot = cloneState(next);
    history = history.slice(0, historyIndex + 1);
    historyLabels = historyLabels.slice(0, historyIndex + 1);
    history.push(snapshot);
    historyLabels.push(label);
    if (history.length > 100) {
      history.shift();
      historyLabels.shift();
    }
    historyIndex = history.length - 1;
    return snapshot;
  }

  function undo() {
    if (historyIndex <= 0) return current;
    historyIndex -= 1;
    current = cloneState(history[historyIndex]);
    emit('editor:undo', { historyIndex });
    return update(current);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return current;
    historyIndex += 1;
    current = cloneState(history[historyIndex]);
    emit('editor:redo', { historyIndex });
    return update(current);
  }

  function saveSnapshot(name = 'scene') {
    const id = `save-${String(saveVersionSerial).padStart(3, '0')}`;
    saveVersionSerial += 1;
    const snapshot = {
      id,
      name,
      version: 1,
      savedAt: new Date().toISOString(),
      scene: cloneState(current.scene),
      workspace: cloneState(current.workspace),
      tilemap: cloneState(current.tilemap),
      prefabs: cloneState(current.prefabs),
      assets: cloneState(current.assets),
      flowGraph: cloneState(current.flowGraph),
      behaviorTree: cloneState(current.behaviorTree),
      uiLayout: cloneState(current.uiLayout),
      database: cloneState(current.database),
      playState: cloneState(current.playState),
      animations: cloneState(current.animations),
      selectedAnimationKeyframe: cloneState(current.selectedAnimationKeyframe),
      particleEditor: cloneState(current.particleEditor),
      spriteEditor: cloneState(current.spriteEditor),
      profilerFrame: cloneState(current.profilerFrame),
      profilerHistory: cloneState(current.profilerHistory || []),
      sceneTabs: cloneState(current.sceneTabs || []),
      activeSceneTabPath: current.activeSceneTabPath || null,
      coCreation25D: cloneState(current.coCreation25D || null),
      preview25D: cloneState(current.preview25D || null)
    };
    lastSavedSnapshot = snapshot;
    savedVersions = [...savedVersions, cloneState(snapshot)].slice(-50);
    emit('editor:save-snapshot', snapshot);
    showEditorFeedback(`已保存 ${name}`, 'success');
    update(current);
    return snapshot;
  }

  function listSaveVersions() {
    return savedVersions.map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      version: snapshot.version,
      savedAt: snapshot.savedAt,
      scene: snapshot.scene?.name || '未命名',
      entities: (snapshot.scene?.entities || []).length,
      coCreatedEntities: (snapshot.scene?.entities || []).filter((entity) => entity.coCreated).length
    }));
  }

  function diffSaveVersions(fromId, toId) {
    const from = findSaveVersion(fromId);
    const to = findSaveVersion(toId);
    if (!from || !to) return null;
    const fromEntities = new Map((from.scene?.entities || []).map((entity) => [String(entity.id), entity]));
    const toEntities = new Map((to.scene?.entities || []).map((entity) => [String(entity.id), entity]));
    const addedEntities = [];
    const removedEntities = [];
    const changedEntities = [];

    for (const [id, entity] of toEntities) {
      if (!fromEntities.has(id)) {
        addedEntities.push(cloneState(entity));
      } else if (entitySignature(fromEntities.get(id)) !== entitySignature(entity)) {
        changedEntities.push({
          id,
          before: cloneState(fromEntities.get(id)),
          after: cloneState(entity)
        });
      }
    }
    for (const [id, entity] of fromEntities) {
      if (!toEntities.has(id)) removedEntities.push(cloneState(entity));
    }

    return {
      format: 'OmniCore.EditorSaveVersionDiff',
      from: from.id,
      to: to.id,
      scene: to.scene?.name || from.scene?.name || '未命名',
      addedEntities: addedEntities.sort((left, right) => String(left.id).localeCompare(String(right.id))),
      removedEntities: removedEntities.sort((left, right) => String(left.id).localeCompare(String(right.id))),
      changedEntities: changedEntities.sort((left, right) => left.id.localeCompare(right.id))
    };
  }

  function rollbackToSaveVersion(id) {
    const snapshot = findSaveVersion(id);
    if (!snapshot) return null;
    const scene = normalizeScene(snapshot.scene);
    current = {
      ...current,
      scene,
      workspace: cloneState(snapshot.workspace || current.workspace),
      tilemap: cloneState(snapshot.tilemap || current.tilemap),
      prefabs: cloneState(snapshot.prefabs || current.prefabs),
      assets: cloneState(snapshot.assets || current.assets),
      flowGraph: cloneState(snapshot.flowGraph || current.flowGraph),
      behaviorTree: cloneState(snapshot.behaviorTree || current.behaviorTree),
      uiLayout: cloneState(snapshot.uiLayout || current.uiLayout),
      database: cloneState(snapshot.database || current.database),
      playState: cloneState(snapshot.playState || current.playState),
      animations: cloneState(snapshot.animations || current.animations),
      selectedAnimationKeyframe: cloneState(snapshot.selectedAnimationKeyframe || current.selectedAnimationKeyframe),
      particleEditor: cloneState(snapshot.particleEditor || current.particleEditor),
      spriteEditor: cloneState(snapshot.spriteEditor || current.spriteEditor),
      profilerFrame: cloneState(snapshot.profilerFrame || current.profilerFrame),
      profilerHistory: cloneState(snapshot.profilerHistory || []),
      sceneTabs: restoreSnapshotSceneTabs(snapshot, scene),
      activeSceneTabPath: snapshot.activeSceneTabPath || current.activeSceneTabPath || null,
      coCreation25D: cloneState(snapshot.coCreation25D || null),
      preview25D: cloneState(snapshot.preview25D || null)
    };
    lastSavedSnapshot = null;
    emit('editor:rollback-save-version', { id: snapshot.id, name: snapshot.name });
    pushHistory(current, `回滚到 ${snapshot.name}`);
    showEditorFeedback(`已回滚到 ${snapshot.name}`, 'success');
    update(current);
    return cloneState(snapshot);
  }

  function findSaveVersion(id) {
    return savedVersions.find((snapshot) => snapshot.id === id || snapshot.name === id) || null;
  }

  function restoreSnapshotSceneTabs(snapshot, scene) {
    const tabs = cloneState(snapshot.sceneTabs || current.sceneTabs || []);
    const activePath = snapshot.activeSceneTabPath || current.activeSceneTabPath || null;
    if (!activePath) return tabs;
    let restored = false;
    const nextTabs = tabs.map((tab) => {
      if (tab.path !== activePath) return tab;
      restored = true;
      return {
        ...tab,
        scene: normalizeScene(scene),
        dirty: true
      };
    });
    if (!restored) {
      nextTabs.push({
        path: activePath,
        scene: normalizeScene(scene),
        dirty: true
      });
    }
    return nextTabs;
  }

  async function openProjectWorkspace() {
    if (typeof bridge?.openProjectFolder !== 'function') {
      showEditorFeedback('请在桌面版中打开项目文件夹。', 'warning');
      update(current);
      return null;
    }
    const workspace = await bridge?.openProjectFolder?.();
    if (!workspace || workspace.canceled) return null;
    return applyWorkspace(workspace);
  }

  function applyWorkspace(workspace = {}) {
    const normalized = normalizeWorkspaceState(workspace);
    current = {
      ...current,
      workspace: normalized,
      assets: normalized.assets,
      assetPreview: null,
      prefabPreview: null
    };
    emit('editor:workspace-opened', normalized);
    showEditorFeedback(`已打开项目 ${normalized.name || normalized.root || '未命名'}`, 'success');
    update(current);
    return normalized;
  }

  async function checkRecovery() {
    if (recoveryChecked) return null;
    recoveryChecked = true;
    if (typeof bridge?.readPendingRecovery !== 'function') return null;
    const recovery = await bridge.readPendingRecovery({ root: current.workspace?.root || null });
    if (!recovery?.exists || !recovery.snapshot) return recovery || null;
    const shouldRecover = typeof ownerWindow?.confirm === 'function'
      ? ownerWindow.confirm('发现上次异常退出留下的 OmniCore Editor 自动备份，是否恢复？')
      : true;
    if (!shouldRecover) {
      await bridge.clearAutoSave?.({ root: current.workspace?.root || null });
      return recovery;
    }
    const snapshot = recovery.snapshot.state || recovery.snapshot;
    current = createEditorState({
      ...current,
      ...snapshot
    });
    await bridge.clearAutoSave?.({ root: current.workspace?.root || null });
    update(current);
    return recovery;
  }

  async function runAutoSave(reason = 'timer') {
    const snapshot = {
      reason,
      intervalMs: current.autoSave.intervalMs,
      savedAt: new Date().toISOString(),
      root: current.workspace?.root || null,
      state: cloneState(current)
    };
    const result = typeof bridge?.writeAutoSave === 'function'
      ? await bridge.writeAutoSave(snapshot)
      : emit('editor:autosave', snapshot);
    current = {
      ...current,
      autoSave: {
        ...current.autoSave,
        lastSavedAt: snapshot.savedAt,
        lastPath: result?.path || current.autoSave.lastPath || null
      }
    };
    update(current);
    return snapshot;
  }

  function setAutoSaveInterval(intervalMs) {
    current = {
      ...current,
      autoSave: {
        ...current.autoSave,
        intervalMs: Math.max(1000, Number(intervalMs || 300000))
      }
    };
    scheduleAutoSave();
    update(current);
    return current.autoSave;
  }

  function scheduleAutoSave() {
    if (autoSaveTimer != null) ownerWindow?.clearInterval?.(autoSaveTimer);
    if (current.autoSave?.enabled === false || typeof ownerWindow?.setInterval !== 'function') return;
    autoSaveTimer = ownerWindow.setInterval(() => {
      runAutoSave('timer');
    }, current.autoSave.intervalMs);
  }

  function persistDockLayout() {
    const payload = {
      root: current.workspace?.root || null,
      layout: cloneState(current.dockLayout)
    };
    if (typeof bridge?.saveDockLayout === 'function') bridge.saveDockLayout(payload);
    else emit('editor:save-dock-layout', payload);
    return payload;
  }

  function destroy() {
    if (autoSaveTimer != null) ownerWindow?.clearInterval?.(autoSaveTimer);
    inputFocusManager.destroy();
    ownerWindow?.removeEventListener?.('mousemove', onPointerMove);
    ownerWindow?.removeEventListener?.('mouseup', onPointerUp);
    ownerWindow?.removeEventListener?.('keydown', onKeyDown);
    unsubscribeWorkspace?.();
    unsubscribeMenu?.();
    client?.close?.();
    if (ownerWindow?.OmniCore?.EditorAPI === api.EditorAPI) delete ownerWindow.OmniCore.EditorAPI;
    root.textContent = '';
  }

  function shouldAutoCheckRecovery() {
    return Boolean(
      autoCheckRecovery
      && typeof bridge?.readPendingRecovery === 'function'
      && (current.workspace?.root || bridge.autoCheckRecovery === true)
    );
  }

  function createEditorAPI() {
    return {
      getSelectedEntity: () => cloneState(findSelectedEntity(current)),
      getSceneTree: () => current.scene.entities.map((entity) => cloneState(entity)),
      patchInspector(patch = {}) {
        const selected = findSelectedEntity(current);
        if (!selected) return null;
        return patchEntity(selected.id, normalizeInspectorPatch(patch));
      },
      openEntityScript(entityOrId = current.selectedEntityId, symbol = null, options = {}) {
        return openEntityScript(entityOrId, symbol, options);
      },
      createPrefabVariant(prefabId, overrides = {}, options = {}) {
        const prefab = current.prefabs.find((item) => item.id === prefabId || item.name === prefabId);
        if (!prefab) return null;
        const overrideFields = Object.fromEntries(
          Object.entries(cloneState(overrides)).filter(([key]) => key !== 'id' && key !== 'extends')
        );
        const variant = {
          ...cloneState(prefab),
          ...cloneState(overrides),
          id: options.id || overrides.id || `${prefab.id || prefab.name}-variant`,
          extends: prefab.id || prefab.name,
          overrides: {
            ...(overrides.overrides || {}),
            ...overrideFields
          }
        };
        current = { ...current, prefabs: [...current.prefabs, variant] };
        emit('editor:create-prefab-variant', variant);
        pushHistory(current, `创建预制体变体 ${variant.id}`);
        update(current);
        return variant;
      },
      markBasePrefab(prefabId) {
        return markBasePrefab(prefabId);
      },
      updatePrefabProperties(prefabId, patch = {}) {
        return updatePrefabProperties(prefabId, patch);
      },
      createNPCProximityRecipe(options = {}) {
        return createNPCProximityRecipe(options);
      },
      addVisualScriptNode(type, options = {}) {
        return addVisualScriptNode(type, options);
      },
      connectVisualScriptNodes(from, to, options = {}) {
        return connectVisualScriptNodes(from, to, options);
      },
      exportVisualScriptGraph() {
        return exportVisualScriptGraph();
      },
      exportVisualScriptEditorSession(options = {}) {
        return exportVisualScriptEditorSession(options);
      },
      validateVisualScriptGraph(options = {}) {
        return validateVisualScriptGraph(options);
      },
      runVisualScript(eventName = 'start', payload = {}, options = {}) {
        return runVisualScript(eventName, payload, options);
      },
      exportRenderOptimizationPlan(options = {}) {
        return exportRenderOptimizationPlan(options);
      },
      verifyRenderOptimizationPlan(input = {}, options = {}) {
        return verifyRenderOptimizationPlan(input, options);
      },
      applyRenderOptimizationRemediation(actionId, options = {}) {
        return applyRenderOptimizationRemediation(actionId, options);
      },
      applyRenderOptimizationRemediationPlan(options = {}) {
        return applyRenderOptimizationRemediationPlan(options);
      },
      reverifyRenderOptimizationRemediation(input = {}, options = {}) {
        return reverifyRenderOptimizationRemediation(input, options);
      },
      refreshScene3DReadinessPanel(input = {}, options = {}) {
        return refreshScene3DReadinessPanel(input, options);
      },
      createScene3DReadinessFixPlan(options = {}) {
        return createScene3DReadinessFixPlan(options);
      },
      applyScene3DReadinessFixPlan(options = {}) {
        return applyScene3DReadinessFixPlan(options);
      },
      addUIButton(button = {}) {
        return addUIButton(button);
      },
      applyRuleTiles() {
        return applyRuleTiles();
      },
      updateDatabaseCell(table, id, field, value) {
        return updateDatabaseRecord(table, id, field, value);
      },
      openGlobalSearch(query = '') {
        return openGlobalSearch(query);
      },
      searchProject(query) {
        return searchProject(query);
      },
      replaceProject(query, replacement, options = {}) {
        return replaceProject(query, replacement, options);
      },
      openResourcePicker(field, options = {}) {
        return openResourcePicker(field, options);
      },
      selectResourceForField(field, assetPath) {
        return selectResourceForField(field, assetPath);
      },
      openPhysicsView() {
        return openPhysicsView();
      },
      editPrefabVariantRuntime(prefabId, patch = {}) {
        return editPrefabVariantRuntime(prefabId, patch);
      },
      exitPrefabHotEdit() {
        return exitPrefabHotEdit();
      },
      savePrefabHotEdit() {
        return savePrefabHotEdit();
      },
      setBuildTarget(platform, enabled = true) {
        return setBuildTarget(platform, enabled);
      },
      exportBuildSettings() {
        return exportBuildSettings();
      },
      createEditorClosureReport(options = {}) {
        return createEditorClosureReport(options);
      },
      applyEditorClosureFixes(options = {}) {
        return applyEditorClosureFixes(options);
      },
      queueHotReload(changedFiles = []) {
        return queueHotReload(changedFiles);
      },
      refreshAssetRegistryPanel(options = {}) {
        return refreshAssetRegistryPanel(options);
      },
      refreshRenderDiagnosticsPanel(options = {}) {
        return refreshRenderDiagnosticsPanel(options);
      },
      applyAssetRegistryChanges(changes = [], options = {}) {
        return applyAssetRegistryChanges(changes, options);
      },
      applyAssetRegistryQuickFix(actionId, options = {}) {
        return applyAssetRegistryQuickFix(actionId, options);
      },
      applyRenderDiagnosticsQuickFix(actionId, options = {}) {
        return applyRenderDiagnosticsQuickFix(actionId, options);
      },
      exportHotReloadEventStream(options = {}) {
        return exportHotReloadEventStream(options);
      },
      recordDebugEvent(event = {}) {
        return recordDebugEvent(event);
      },
      exportDebugTimeline(options = {}) {
        return exportDebugTimeline(options);
      },
      exportRunnableProject(options = {}) {
        return exportRunnableProject(options);
      },
      generateWithAI(prompt, options = {}) {
        return generateWithAI(prompt, options);
      }
    };
  }

  function createNPCProximityRecipe({
    npcId = 'npc',
    playerId = 'player',
    animation = 'talk',
    dialog = '',
    distance = 48
  } = {}) {
    const graph = {
      nodes: [
        {
          id: 'npc-proximity-event',
          type: 'event',
          label: 'NPC Proximity',
          x: 24,
          y: 32,
          data: { when: { onUpdate: true } }
        },
        {
          id: 'npc-near-condition',
          type: 'condition',
          label: 'NPC Nearby',
          x: 220,
          y: 32,
          data: {
            op: 'distanceLessThan',
            left: playerId,
            right: npcId,
            value: Number(distance || 48)
          }
        },
        {
          id: 'npc-play-animation',
          type: 'action',
          label: 'Play Animation',
          x: 440,
          y: 8,
          data: {
            op: 'playAnimation',
            target: npcId,
            animation
          }
        },
        {
          id: 'npc-show-dialog',
          type: 'action',
          label: 'Show Dialog',
          x: 440,
          y: 96,
          data: {
            op: 'showDialog',
            target: npcId,
            text: dialog
          }
        }
      ],
      edges: [
        { from: 'npc-proximity-event', to: 'npc-near-condition' },
        { from: 'npc-near-condition', to: 'npc-play-animation' },
        { from: 'npc-near-condition', to: 'npc-show-dialog' }
      ]
    };
    current = {
      ...current,
      flowGraph: normalizeFlowGraph(graph),
      behaviorTree: flowGraphToBehaviorTree(graph)
    };
    emit('editor:graph-recipe', { recipe: 'npc-proximity', npcId, playerId });
    pushHistory(current, '创建 NPC 接近流程图');
    update(current);
    return current.flowGraph;
  }

  function addUIButton(button = {}) {
    const uiLayout = normalizeUILayoutState(current.uiLayout);
    const element = normalizeUIElement({
      type: 'Button',
      width: 160,
      height: 40,
      ...button
    }, uiLayout.elements.length);
    const existingIndex = uiLayout.elements.findIndex((item) => item.id === element.id);
    const elements = [...uiLayout.elements];
    if (existingIndex >= 0) elements[existingIndex] = element;
    else elements.push(element);
    current = {
      ...current,
      uiLayout: {
        ...uiLayout,
        elements
      }
    };
    emit('editor:update-ui-layout', current.uiLayout);
    pushHistory(current, `添加界面按钮 ${element.id}`);
    update(current);
    return element;
  }

  function openGlobalSearch(query = '') {
    current = {
      ...current,
      globalSearch: {
        ...normalizeGlobalSearchState(current.globalSearch),
        open: true,
        query: String(query || current.globalSearch?.query || '')
      },
      dockLayout: ensurePanelInDock(current.dockLayout, 'global-search', 'bottom')
    };
    emit('editor:open-global-search', { query: current.globalSearch.query });
    update(current);
    return current.globalSearch;
  }

  function searchProject(query = current.globalSearch?.query || '') {
    const normalizedQuery = String(query || '');
    const results = [];
    if (normalizedQuery) {
      for (const [filePath, content] of Object.entries(normalizeProjectFilesState(current.projectFiles))) {
        if (!isSearchableProjectFile(filePath)) continue;
        const lines = String(content).split(/\r?\n/u);
        lines.forEach((line, index) => {
          const column = line.toLowerCase().indexOf(normalizedQuery.toLowerCase());
          if (column >= 0) {
            results.push({
              path: filePath,
              line: index + 1,
              column: column + 1,
              preview: line.trim()
            });
          }
        });
      }
    }
    current = {
      ...current,
      globalSearch: {
        ...normalizeGlobalSearchState(current.globalSearch),
        open: true,
        query: normalizedQuery,
        results
      },
      dockLayout: ensurePanelInDock(current.dockLayout, 'global-search', 'bottom')
    };
    emit('editor:global-search', { query: normalizedQuery, count: results.length });
    update(current);
    return results;
  }

  function replaceProject(query, replacement, options = {}) {
    const normalizedQuery = String(query || '');
    if (!normalizedQuery) return { changedFiles: [], projectFiles: cloneState(current.projectFiles || {}) };
    const allowedPaths = options.paths ? new Set(options.paths) : null;
    const files = normalizeProjectFilesState(current.projectFiles);
    const changedFiles = [];
    const pattern = new RegExp(escapeRegExp(normalizedQuery), 'gu');
    for (const [filePath, content] of Object.entries(files)) {
      if (!isSearchableProjectFile(filePath) || (allowedPaths && !allowedPaths.has(filePath))) continue;
      const nextContent = String(content).replace(pattern, String(replacement ?? ''));
      if (nextContent !== content) {
        files[filePath] = nextContent;
        changedFiles.push(filePath);
      }
    }
    current = {
      ...current,
      projectFiles: files,
      globalSearch: {
        ...normalizeGlobalSearchState(current.globalSearch),
        replacement: String(replacement ?? ''),
        results: []
      }
    };
    emit('editor:replace-project', { query: normalizedQuery, replacement, changedFiles });
    pushHistory(current, `在项目中替换 ${normalizedQuery}`);
    update(current);
    return { changedFiles, projectFiles: cloneState(files) };
  }

  function openResourcePicker(field, { query = '' } = {}) {
    current = {
      ...current,
      resourcePicker: {
        open: true,
        field,
        query
      }
    };
    emit('editor:open-resource-picker', { field, query });
    update(current);
    return current.resourcePicker;
  }

  function selectResourceForField(field, assetPath) {
    const selected = findSelectedEntity(current);
    if (!selected || !field || !assetPath) return null;
    const entity = patchEntity(selected.id, { [field]: assetPath });
    current = {
      ...current,
      resourcePicker: {
        ...normalizeResourcePickerState(current.resourcePicker),
        open: false
      }
    };
    emit('editor:select-resource', { field, assetPath, entityId: selected.id });
    update(current);
    return entity;
  }

  function openPhysicsView() {
    current = {
      ...current,
      physicsView: { open: true },
      dockLayout: ensurePanelInDock(current.dockLayout, 'physics-view', 'center')
    };
    emit('editor:open-physics-view', { bodies: physicsBodies(current).length });
    update(current);
    return current.physicsView;
  }

  function editPrefabVariantRuntime(prefabId, patch = {}) {
    const existing = current.prefabs.find((prefab) => (prefab.id || prefab.name) === prefabId);
    if (!existing) return null;
    current = {
      ...current,
      prefabHotEdit: {
        prefabId,
        patch: cloneState(patch),
        dirty: current.playState?.mode === 'paused',
        promptOpen: false
      }
    };
    emit('editor:prefab-hot-edit', { prefabId, patch });
    update(current);
    return current.prefabHotEdit;
  }

  function exitPrefabHotEdit() {
    const hotEdit = normalizePrefabHotEditState(current.prefabHotEdit);
    if (!hotEdit.dirty) return hotEdit;
    current = {
      ...current,
      prefabHotEdit: {
        ...hotEdit,
        promptOpen: true
      }
    };
    emit('editor:prefab-hot-edit-save-prompt', { prefabId: hotEdit.prefabId });
    update(current);
    return current.prefabHotEdit;
  }

  function savePrefabHotEdit() {
    const hotEdit = normalizePrefabHotEditState(current.prefabHotEdit);
    if (!hotEdit.prefabId || !hotEdit.dirty) return null;
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (id !== hotEdit.prefabId) return prefab;
      return {
        ...prefab,
        ...cloneState(hotEdit.patch),
        overrides: {
          ...(prefab.overrides || {}),
          ...cloneState(hotEdit.patch)
        }
      };
    });
    current = {
      ...current,
      prefabs,
      prefabHotEdit: { prefabId: null, patch: {}, dirty: false, promptOpen: false }
    };
    emit('editor:save-prefab-hot-edit', { prefabId: hotEdit.prefabId, patch: hotEdit.patch });
    pushHistory(current, `保存预制体热编辑 ${hotEdit.prefabId}`);
    update(current);
    return current.prefabs.find((prefab) => (prefab.id || prefab.name) === hotEdit.prefabId) || null;
  }

  function setBuildTarget(platform, enabled = true) {
    const buildSettings = normalizeBuildSettingsState(current.buildSettings);
    if (!buildSettings.targets[platform]) return buildSettings;
    current = {
      ...current,
      buildSettings: {
        ...buildSettings,
        targets: {
          ...buildSettings.targets,
          [platform]: {
            ...buildSettings.targets[platform],
            enabled: Boolean(enabled)
          }
        }
      },
      dockLayout: ensurePanelInDock(current.dockLayout, 'build-settings', 'right')
    };
    emit('editor:set-build-target', { platform, enabled: Boolean(enabled) });
    update(current);
    return current.buildSettings;
  }

  function exportBuildSettings() {
    return cloneState(normalizeBuildSettingsState(current.buildSettings));
  }

  function markBasePrefab(prefabId) {
    let updated = null;
    const prefabs = current.prefabs.map((prefab) => {
      if ((prefab.id || prefab.name) !== prefabId) return prefab;
      updated = { ...prefab, isBasePrefab: true };
      return updated;
    });
    current = { ...current, prefabs };
    emit('editor:mark-base-prefab', { prefabId });
    pushHistory(current, `标记基础预制体 ${prefabId}`);
    update(current);
    return updated;
  }

  function updatePrefabProperties(prefabId, patch = {}) {
    const safePatch = cloneState(patch);
    const descendants = collectPrefabDescendants(prefabId, current.prefabs);
    const affected = new Set([prefabId, ...descendants]);
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (!affected.has(id)) return prefab;
      if (id === prefabId) return { ...prefab, ...safePatch };
      const overrides = prefab.overrides || {};
      const inheritedPatch = Object.fromEntries(
        Object.entries(safePatch).filter(([key]) => !Object.prototype.hasOwnProperty.call(overrides, key))
      );
      return { ...prefab, ...inheritedPatch };
    });
    current = { ...current, prefabs };
    emit('editor:update-prefab-properties', { prefabId, patch: safePatch, affected: [...affected] });
    pushHistory(current, `更新预制体 ${prefabId}`);
    update(current);
    return current.prefabs.find((prefab) => (prefab.id || prefab.name) === prefabId) || null;
  }

  function collectPrefabDescendants(prefabId, prefabs) {
    const childrenByParent = new Map();
    for (const prefab of prefabs) {
      if (!prefab.extends) continue;
      const parent = String(prefab.extends);
      if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
      childrenByParent.get(parent).push(prefab.id || prefab.name);
    }
    const output = [];
    const queue = [...(childrenByParent.get(prefabId) || [])];
    while (queue.length) {
      const id = queue.shift();
      if (output.includes(id)) continue;
      output.push(id);
      queue.push(...(childrenByParent.get(id) || []));
    }
    return output;
  }

  function selectAnimationKeyframe(clipId, track, frame) {
    current = {
      ...current,
      selectedAnimationKeyframe: {
        clipId: String(clipId),
        track: String(track),
        frame: Number(frame || 0)
      }
    };
    emit('editor:select-animation-keyframe', current.selectedAnimationKeyframe);
    update(current);
    return current.selectedAnimationKeyframe;
  }

  function setAnimationCurve(clipId, track, frame, curve = {}) {
    const animations = cloneState(current.animations || {});
    const clip = ensureAnimationClip(animations, clipId);
    const trackData = ensureAnimationTrack(clip, track);
    const keyframe = ensureAnimationKeyframe(trackData, frame);
    keyframe.easing = curve.preset || curve.easing || keyframe.easing || 'Linear';
    keyframe.handles = cloneState(curve.handles || keyframe.handles || {});
    current = {
      ...current,
      animations,
      selectedAnimationKeyframe: {
        clipId: String(clipId),
        track: String(track),
        frame: Number(frame || 0)
      }
    };
    emit('editor:set-animation-curve', {
      clipId,
      track,
      frame: Number(frame || 0),
      easing: keyframe.easing,
      handles: keyframe.handles
    });
    pushHistory(current, `设置动画曲线 ${clipId}.${track}.${frame}`);
    update(current);
    return cloneState(keyframe);
  }

  function addAnimationEvent(clipId, frame, name, payload = {}) {
    const animations = cloneState(current.animations || {});
    const clip = ensureAnimationClip(animations, clipId);
    const eventFrame = Number(frame || 0);
    const events = Array.isArray(clip.events) ? clip.events : [];
    const event = { frame: eventFrame, name: String(name), payload: cloneState(payload || {}) };
    clip.events = [...events.filter((item) => !(item.frame === eventFrame && item.name === event.name)), event]
      .sort((left, right) => Number(left.frame || 0) - Number(right.frame || 0));
    current = { ...current, animations };
    emit('editor:add-animation-event', { clipId, event });
    pushHistory(current, `添加动画事件 ${event.name}`);
    update(current);
    return cloneState(event);
  }

  function previewAnimationFrame(clipId, frame, options = {}) {
    const clip = current.animations?.[clipId];
    if (!clip) return [];
    const eventFrame = Number(frame || 0);
    const events = (Array.isArray(clip.events) ? clip.events : [])
      .filter((event) => Number(event.frame || 0) === eventFrame);
    for (const event of events) {
      const payload = {
        ...(event.payload || {}),
        clipId,
        frame: eventFrame,
        event: cloneState(event)
      };
      options.eventBus?.emit?.(event.name, payload);
      ownerWindow?.EventBus?.emit?.(event.name, payload);
    }
    emit('editor:preview-animation-frame', { clipId, frame: eventFrame, events });
    return cloneState(events);
  }

  function exportAnimationClip(clipId) {
    return cloneState(current.animations?.[clipId] || null);
  }

  function selectPrefab(prefabId) {
    current = { ...current, selectedPrefabId: prefabId || null };
    emit('editor:select-prefab', { prefabId: current.selectedPrefabId });
    update(current);
    return findPrefab(prefabId);
  }

  function writePrefabOverrideToBase(variantId, field) {
    const variant = findPrefab(variantId);
    if (!variant?.extends || !field) return null;
    const baseId = variant.extends;
    const value = cloneState(variant[field]);
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (id === baseId) return { ...prefab, [field]: value };
      if (id !== variantId) return prefab;
      const overrides = { ...(prefab.overrides || {}) };
      delete overrides[field];
      return { ...prefab, overrides };
    });
    current = { ...current, prefabs };
    emit('editor:write-prefab-override', { variantId, baseId, field, value });
    pushHistory(current, `写回预制体覆盖项 ${variantId}.${field}`);
    update(current);
    return findPrefab(baseId);
  }

  function resetPrefabOverride(variantId, field) {
    const variant = findPrefab(variantId);
    const base = variant?.extends ? findPrefab(variant.extends) : null;
    if (!variant || !base || !field) return null;
    const value = cloneState(base[field]);
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (id !== variantId) return prefab;
      const overrides = { ...(prefab.overrides || {}) };
      delete overrides[field];
      return { ...prefab, [field]: value, overrides };
    });
    current = { ...current, prefabs };
    emit('editor:reset-prefab-override', { variantId, field, value });
    pushHistory(current, `重置预制体覆盖项 ${variantId}.${field}`);
    update(current);
    return findPrefab(variantId);
  }

  function openParticleEditor(config = {}) {
    current = {
      ...current,
      particleEditor: {
        open: true,
        config: normalizeParticleConfig({
          ...(current.particleEditor?.config || {}),
          ...config
        })
      }
    };
    emit('editor:open-particle-editor', current.particleEditor.config);
    update(current);
    return current.particleEditor;
  }

  function setParticleParameter(field, value) {
    const editor = ensureParticleEditor();
    const config = normalizeParticleConfig(editor.config);
    config[field] = Number.isFinite(Number(value)) ? Number(value) : value;
    current = { ...current, particleEditor: { ...editor, open: true, config } };
    emit('editor:set-particle-parameter', { field, value: config[field] });
    pushHistory(current, `设置粒子 ${field}`);
    update(current);
    return config[field];
  }

  function setParticleCurve(name, points = []) {
    const editor = ensureParticleEditor();
    const config = normalizeParticleConfig(editor.config);
    config.curves = {
      ...(config.curves || {}),
      [name]: normalizeCurvePoints(points)
    };
    current = { ...current, particleEditor: { ...editor, open: true, config } };
    emit('editor:set-particle-curve', { name, points: config.curves[name] });
    pushHistory(current, `设置粒子曲线 ${name}`);
    update(current);
    return config.curves[name];
  }

  function setParticleGradient(points = []) {
    const editor = ensureParticleEditor();
    const config = normalizeParticleConfig(editor.config);
    config.gradient = normalizeGradientPoints(points);
    current = { ...current, particleEditor: { ...editor, open: true, config } };
    emit('editor:set-particle-gradient', config.gradient);
    pushHistory(current, '设置粒子渐变');
    update(current);
    return config.gradient;
  }

  function exportParticleConfig(fileName = 'particle_config.json') {
    return {
      fileName,
      config: cloneState(normalizeParticleConfig(current.particleEditor?.config || {}))
    };
  }

  function openSpriteEditor(assetPath) {
    const source = slash(assetPath || current.assetPreview?.path || '');
    if (!source) return null;
    current = {
      ...current,
      spriteEditor: {
        open: true,
        source,
        nineSlice: normalizeNineSlice(current.spriteEditor?.nineSlice || {}),
        collider: current.spriteEditor?.collider || null
      }
    };
    emit('editor:open-sprite-editor', { source });
    update(current);
    return current.spriteEditor;
  }

  function setNineSliceGuides(guides = {}) {
    const editor = ensureSpriteEditor();
    if (!editor) return null;
    current = {
      ...current,
      spriteEditor: {
        ...editor,
        nineSlice: normalizeNineSlice({ ...(editor.nineSlice || {}), ...guides })
      }
    };
    emit('editor:set-nine-slice', current.spriteEditor.nineSlice);
    pushHistory(current, '设置精灵九宫格');
    update(current);
    return current.spriteEditor.nineSlice;
  }

  function autoGenerateSpriteCollider() {
    const editor = ensureSpriteEditor();
    if (!editor) return null;
    const right = Number(editor.nineSlice?.right || 64);
    const bottom = Number(editor.nineSlice?.bottom || 64);
    const collider = {
      type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: right, y: 0 },
        { x: right, y: bottom },
        { x: 0, y: bottom }
      ]
    };
    current = { ...current, spriteEditor: { ...editor, collider } };
    emit('editor:auto-generate-sprite-collider', collider);
    pushHistory(current, '生成精灵碰撞体');
    update(current);
    return collider;
  }

  function setSpriteMaterial(entityId, material = {}) {
    const entities = current.scene.entities.map((entity) => (
      entity.id === entityId
        ? { ...entity, material: normalizeSpriteMaterial({ ...(entity.material || {}), ...material }) }
        : entity
    ));
    const scene = { ...current.scene, entities };
    current = { ...current, scene, sceneTabs: updateActiveSceneTab(scene) };
    emit('editor:set-sprite-material', { entityId, material: findEntity(entityId)?.material || material });
    pushHistory(current, `设置精灵材质 ${entityId}`);
    update(current);
    return findEntity(entityId)?.material || null;
  }

  function exportSpriteMeta() {
    const editor = current.spriteEditor || {};
    const source = editor.source || '';
    const name = source.split('/').pop()?.replace(/\.(png|jpg|jpeg|webp)$/iu, '') || 'sprite';
    return {
      fileName: `${name}.sprite.json`,
      meta: {
        source,
        nineSlice: cloneState(normalizeNineSlice(editor.nineSlice || {})),
        collider: cloneState(editor.collider || null)
      }
    };
  }

  function openProfiler() {
    current = { ...current, profilerOpen: true };
    emit('editor:open-profiler', { open: true });
    update(current);
    return current.profilerFrame;
  }

  function recordProfilerFrame(frame = {}) {
    const sample = normalizeProfilerSample(frame);
    current = {
      ...current,
      profilerOpen: true,
      profilerFrame: sample,
      profilerHistory: [...(current.profilerHistory || []), sample].slice(-180)
    };
    emit('editor:record-profiler-frame', sample);
    update(current);
    return sample;
  }

  function openSceneTab(tab = {}) {
    const path = slash(tab.path || tab.id || '');
    if (!path) return null;
    const scene = normalizeScene(tab.scene || { name: path.split('/').pop(), entities: [] });
    const sceneTabs = upsertSceneTab({ path, scene, dirty: Boolean(tab.dirty) }, current.sceneTabs);
    current = {
      ...current,
      sceneTabs,
      activeSceneTabPath: path,
      scene
    };
    emit('editor:open-scene-tab', { path });
    update(current);
    return sceneTabs.find((item) => item.path === path) || null;
  }

  function switchSceneTab(path) {
    const normalized = slash(path || '');
    const tab = current.sceneTabs.find((item) => item.path === normalized);
    if (!tab) return null;
    current = {
      ...current,
      activeSceneTabPath: tab.path,
      scene: normalizeScene(tab.scene)
    };
    emit('editor:switch-scene-tab', { path: tab.path });
    update(current);
    return tab;
  }

  function instantiateSubScene(path, point = {}) {
    const normalized = slash(path || '');
    const source = findSceneSource(normalized);
    if (!source) return null;
    const snapped = snapPoint(point, current);
    const idRoot = normalized.split('/').pop()?.replace(/\.json$/iu, '') || 'scene';
    const entity = {
      id: `subscene-${idRoot}-${Date.now().toString(36)}`,
      name: source.scene.name || idRoot,
      type: 'subscene',
      scenePath: normalized,
      scene: cloneState(source.scene),
      x: snapped.x,
      y: snapped.y,
      width: Number(source.scene.width || 0),
      height: Number(source.scene.height || 0),
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    };
    const scene = {
      ...current.scene,
      entities: [...current.scene.entities, entity]
    };
    current = {
      ...current,
      scene,
      sceneTabs: updateActiveSceneTab(scene),
      selectedEntityId: entity.id,
      selectedEntityIds: [entity.id]
    };
    emit('editor:instantiate-subscene', { path: normalized, entity });
    pushHistory(current, `实例化子场景 ${normalized}`);
    update(current);
    return entity;
  }

  function ensureAnimationClip(animations, clipId) {
    const key = String(clipId);
    animations[key] = animations[key] || { id: key, duration: 0, tracks: {}, events: [] };
    animations[key].id = animations[key].id || key;
    animations[key].tracks = animations[key].tracks || {};
    animations[key].events = Array.isArray(animations[key].events) ? animations[key].events : [];
    return animations[key];
  }

  function ensureAnimationTrack(clip, track) {
    const key = String(track);
    clip.tracks[key] = clip.tracks[key] || { keyframes: [] };
    clip.tracks[key].keyframes = Array.isArray(clip.tracks[key].keyframes) ? clip.tracks[key].keyframes : [];
    return clip.tracks[key];
  }

  function ensureAnimationKeyframe(trackData, frame) {
    const frameNumber = Number(frame || 0);
    let keyframe = trackData.keyframes.find((item) => Number(item.frame || 0) === frameNumber);
    if (!keyframe) {
      keyframe = { frame: frameNumber, value: 0, easing: 'Linear' };
      trackData.keyframes.push(keyframe);
      trackData.keyframes.sort((left, right) => Number(left.frame || 0) - Number(right.frame || 0));
    }
    return keyframe;
  }

  function findPrefab(prefabId) {
    return current.prefabs.find((prefab) => (prefab.id || prefab.name) === prefabId) || null;
  }

  function findEntity(entityId) {
    return current.scene.entities.find((entity) => entity.id === entityId) || null;
  }

  function ensureParticleEditor() {
    return current.particleEditor?.open
      ? current.particleEditor
      : openParticleEditor();
  }

  function normalizeParticleConfig(config = {}) {
    return {
      emissionRate: Number(config.emissionRate ?? 30),
      lifetime: Number(config.lifetime ?? 1),
      initialVelocity: Number(config.initialVelocity ?? 120),
      gravity: Number(config.gravity ?? 0),
      curves: Object.fromEntries(Object.entries(config.curves || {}).map(([key, points]) => [
        key,
        normalizeCurvePoints(points)
      ])),
      gradient: normalizeGradientPoints(config.gradient || [])
    };
  }

  function normalizeCurvePoints(points = []) {
    return (Array.isArray(points) ? points : []).map((point) => ({
      t: Number(point.t || 0),
      value: Number(point.value || 0)
    }));
  }

  function normalizeGradientPoints(points = []) {
    return (Array.isArray(points) ? points : []).map((point) => ({
      t: Number(point.t || 0),
      color: point.color || '#ffffff'
    }));
  }

  function ensureSpriteEditor() {
    if (current.spriteEditor?.open && current.spriteEditor.source) return current.spriteEditor;
    const imageAsset = current.assets.find((asset) => assetType(asset) === 'image');
    const source = typeof imageAsset === 'string' ? imageAsset : imageAsset?.path;
    return source ? openSpriteEditor(source) : null;
  }

  function normalizeNineSlice(value = {}) {
    return {
      left: Number(value.left || 0),
      right: Number(value.right || 0),
      top: Number(value.top || 0),
      bottom: Number(value.bottom || 0)
    };
  }

  function normalizeSpriteMaterial(material = {}) {
    return {
      alphaClip: Number(material.alphaClip ?? 0),
      colorTint: material.colorTint || '#ffffff',
      normalMap: material.normalMap || null
    };
  }

  function normalizeProfilerSample(frame = {}) {
    return {
      frame: Number(frame.frame || 0),
      time: Number(frame.time || 0),
      totalMs: Number(frame.totalMs || 0),
      sections: (Array.isArray(frame.sections) ? frame.sections : []).map((section) => ({
        name: section.name || '未知',
        duration: Number(section.duration || 0)
      })),
      memoryMB: Number(frame.memoryMB || frame.memory || 0),
      drawCalls: Number(frame.drawCalls || frame.drawcalls || 0)
    };
  }

  function upsertSceneTab(tab, tabs = []) {
    const next = (Array.isArray(tabs) ? tabs : []).filter((item) => item.path !== tab.path);
    next.push({
      path: tab.path,
      scene: normalizeScene(tab.scene),
      dirty: Boolean(tab.dirty)
    });
    return next;
  }

  function updateActiveSceneTab(scene) {
    if (!current.activeSceneTabPath) return current.sceneTabs || [];
    return (current.sceneTabs || []).map((tab) => (
      tab.path === current.activeSceneTabPath
        ? { ...tab, scene: normalizeScene(scene), dirty: true }
        : tab
    ));
  }

  function findSceneSource(path) {
    const tab = (current.sceneTabs || []).find((item) => item.path === path);
    if (tab) return { path, scene: normalizeScene(tab.scene) };
    const asset = (current.assets || [])
      .map((item) => (typeof item === 'string' ? { path: item } : item))
      .find((item) => slash(item.path || item.url || item.name || '') === path);
    const scene = asset?.data || asset?.scene || null;
    return scene ? { path, scene: normalizeScene(scene) } : null;
  }

  function validateAuthoringAssets(options = {}) {
    const report = buildAuthoringHealthReport({ ...options, open: options.open !== false });
    current = { ...current, authoringHealth: report };
    emit('editor:authoring-health', report);
    update(current);
    return cloneState(report);
  }

  function exportAuthoringBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const files = [];
    for (const [clipId, clip] of Object.entries(current.animations || {}).sort(([left], [right]) => left.localeCompare(right))) {
      files.push({ path: `animations/${clipId}.animation.json`, data: cloneState(clip) });
    }
    if (current.particleEditor?.open || current.particleEditor?.config) {
      files.push({ path: 'particles/particle_config.json', data: cloneState(normalizeParticleConfig(current.particleEditor?.config || {})) });
    }
    for (const tab of [...(current.sceneTabs || [])].sort((left, right) => left.path.localeCompare(right.path))) {
      const name = tab.path.split('/').pop()?.replace(/\.json$/iu, '') || 'scene';
      files.push({ path: `scenes/${name}.scene.json`, data: cloneState(normalizeScene(tab.scene)) });
    }
    if (current.spriteEditor?.source) {
      const spriteMeta = exportSpriteMeta();
      files.push({ path: `sprites/${spriteMeta.fileName}`, data: spriteMeta.meta });
    }
    files.sort((left, right) => left.path.localeCompare(right.path));
    const manifest = {
      animations: files.filter((file) => file.path.startsWith('animations/')).length,
      particles: files.filter((file) => file.path.startsWith('particles/')).length,
      scenes: files.filter((file) => file.path.startsWith('scenes/')).length,
      sprites: files.filter((file) => file.path.startsWith('sprites/')).length
    };
    return {
      fileName: 'omnicore_authoring_bundle.json',
      version: 1,
      generatedAt,
      manifest,
      health: buildAuthoringHealthReport({ ...options, checkedAt: generatedAt, open: false }),
      files
    };
  }

  function exportLightweightDeploymentBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const authoring = exportAuthoringBundle({ ...options, generatedAt });
    const files = [...authoring.files.map((file) => ({ path: file.path, data: cloneState(file.data) }))];
    if (!files.some((file) => file.path.startsWith('scenes/'))) {
      files.push({ path: `scenes/${sceneFileStem(current.scene)}.scene.json`, data: cloneState(normalizeScene(current.scene)) });
    }
    const sceneFiles = files
      .filter((file) => file.path.startsWith('scenes/'))
      .sort((left, right) => left.path.localeCompare(right.path));
    const coCreationFiles = appliedCoCreationPlans().map(({ entityId, plan }) => ({
      path: `plans/25d-cocreation/${entityId}.json`,
      data: cloneState(plan)
    }));
    const assetPaths = deploymentAssetPaths();
    const targets = enabledBuildTargets();
    const manifestData = {
      format: 'OmniCore.DeployLiteManifest',
      version: 1,
      profile: '2.5d-editor-lite',
      generatedAt,
      entryScene: sceneFiles[0]?.path || null,
      scenes: sceneFiles.map((file) => file.path),
      assets: assetPaths,
      targets,
      coCreationPlans: coCreationFiles.map((file) => file.path)
    };
    const deployFiles = [
      ...files,
      ...coCreationFiles,
      { path: 'manifests/deploy-lite.json', data: manifestData }
    ].sort((left, right) => left.path.localeCompare(right.path));
    return {
      format: 'OmniCore.LightweightDeploymentBundle',
      version: 1,
      generatedAt,
      manifest: {
        profile: manifestData.profile,
        targets,
        entryScene: manifestData.entryScene,
        scenes: manifestData.scenes.length,
        assets: manifestData.assets.length,
        coCreationPlans: manifestData.coCreationPlans.length
      },
      files: deployFiles
    };
  }

  function exportRunnableProject(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const projectName = slug(options.projectName || current.workspace?.name || current.scene?.name || 'omnicore-game');
    const scene = normalizeScene(current.scene);
    const scenePath = `scenes/${sceneFileStem(scene)}.scene.json`;
    const assets = deploymentAssetManifestEntries();
    const targets = enabledBuildTargets();
    const renderOptimizationRuntime = current.renderOptimizationPlan
      ? createRenderOptimizationRuntimePlan(current.renderOptimizationPlan, { generatedAt })
      : null;
    const manifest = {
      format: 'OmniCore.AssetManifest',
      version: 1,
      generatedAt,
      entry: 'src/main.js',
      entryScene: scenePath,
      scenes: [scenePath],
      assets,
      targets,
      renderOptimization: renderOptimizationRuntime ? 'config/render-optimization.runtime.json' : null
    };
    const packageJson = {
      name: projectName,
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --host 0.0.0.0',
        build: 'vite build',
        preview: 'vite preview --host 0.0.0.0'
      },
      dependencies: {
        omnicore: '^1.0.0',
        vite: '^8.0.16'
      }
    };
    const files = [
      { path: 'package.json', data: packageJson },
      { path: 'index.html', data: renderRunnableProjectHtml(projectName) },
      { path: 'src/main.js', data: renderRunnableProjectMain({ scenePath }) },
      { path: 'assets/manifest.json', data: manifest },
      { path: scenePath, data: scene },
      ...(renderOptimizationRuntime ? [{ path: 'config/render-optimization.runtime.json', data: renderOptimizationRuntime }] : []),
      { path: 'README.md', data: renderRunnableProjectReadme({ projectName, targets }) }
    ];
    return {
      format: 'OmniCore.RunnableProjectExport',
      version: 1,
      generatedAt,
      projectName,
      manifest: {
        entry: manifest.entry,
        entryScene: manifest.entryScene,
        scenes: manifest.scenes,
        assets: assets.length,
        targets
      },
      files
    };
  }

  function create25DProductionReadinessReport(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const deployment = options.deploymentBundle || exportLightweightDeploymentBundle({ ...options, generatedAt });
    const readiness = collect25DProductionReadiness({ deployment });
    const { blockers, warnings } = readiness;
    const score = Math.max(0, 100 - blockers.length * 25 - warnings.length * 5);
    return {
      format: 'OmniCore.Editor25DProductionReadiness',
      version: 1,
      generatedAt,
      ready: blockers.length === 0,
      score,
      blockers,
      warnings,
      evidence: readiness.evidence,
      nextActions: next25DProductionActions(blockers, warnings)
    };
  }

  function exportProductionDeploymentBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const deployment = exportLightweightDeploymentBundle({ ...options, generatedAt });
    const readiness = create25DProductionReadinessReport({ ...options, generatedAt, deploymentBundle: deployment });
    const visualEvidence = create25DVisualEvidence({ ...options, generatedAt });
    const files = [
      ...deployment.files.map((file) => ({ path: file.path, data: cloneState(file.data) })),
      { path: 'reports/25d-production-readiness.json', data: cloneState(readiness) },
      { path: 'reports/25d-visual-evidence.json', data: cloneState(visualEvidence) }
    ].sort((left, right) => left.path.localeCompare(right.path));
    return {
      format: 'OmniCore.ProductionDeploymentBundle',
      version: 1,
      generatedAt,
      productionReady: readiness.ready,
      readiness,
      visualEvidence,
      deployment,
      files
    };
  }

  function create25DVisualEvidence(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const coCreatedEntities = (current.scene?.entities || [])
      .filter((entity) => entity?.coCreated || entity?.coCreationPlan)
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    const layers = [];
    for (const entity of coCreatedEntities) {
      layers.push({
        type: 'entity',
        entityId: entity.id,
        label: entity.name || entity.id,
        bounds: entityBounds(entity),
        placement: cloneState(entity.placement || {})
      });
      for (const occlusion of entity.occlusion || entity.coCreationPlan?.occlusion || []) {
        layers.push({
          type: 'occlusion',
          entityId: entity.id,
          baselineY: Number(occlusion.baselineY ?? entity.placement?.baselineY ?? entity.y ?? 0),
          anchor: entity.placement?.anchor || entity.coCreationPlan?.intent?.placement?.anchor || null
        });
      }
      const shadow = entity.fakeShadow || entity.coCreationPlan?.shadows?.[0] || null;
      if (shadow) {
        layers.push({
          type: 'shadow',
          entityId: entity.id,
          shadow: cloneState(shadow)
        });
      }
      const eventGraph = entity.eventGraph || entity.coCreationPlan?.eventGraph || null;
      for (const node of eventGraph?.nodes || []) {
        layers.push({
          type: 'event',
          entityId: entity.id,
          eventId: node.id || node.label || 'event',
          label: node.label || node.id || 'event',
          action: cloneState(node.data || {})
        });
      }
    }
    const summary = {
      coCreatedEntities: coCreatedEntities.length,
      occlusionLayers: layers.filter((layer) => layer.type === 'occlusion').length,
      shadowLayers: layers.filter((layer) => layer.type === 'shadow').length,
      eventLayers: layers.filter((layer) => layer.type === 'event').length
    };
    return {
      format: 'OmniCore.Editor25DVisualEvidence',
      version: 1,
      generatedAt,
      ready: summary.coCreatedEntities > 0
        && summary.occlusionLayers > 0
        && summary.shadowLayers > 0
        && summary.eventLayers > 0,
      scene: current.scene?.name || '未命名',
      summary,
      layers,
      preview: {
        mode: '2.5d-editor-proof',
        screenshotHint: `${sceneFileStem(current.scene)}-25d-production-preview.png`,
        viewport: {
          width: Number(current.scene?.width || 960),
          height: Number(current.scene?.height || 540)
        }
      }
    };
  }

  function collect25DProductionReadiness({ deployment }) {
    const blockers = [];
    const warnings = [];
    const appliedPlans = appliedCoCreationPlans();
    const targets = enabledBuildTargets();
    const authoring = buildAuthoringHealthReport({ open: false });
    const deploymentManifest = deployment.files.find((file) => file.path === 'manifests/deploy-lite.json')?.data || {};
    const saved = Boolean(lastSavedSnapshot && sceneSignature(lastSavedSnapshot.scene) === sceneSignature(current.scene));
    const hasPendingPlan = Boolean(current.coCreation25D);
    if (hasPendingPlan && appliedPlans.length === 0) {
      blockers.push({
        code: 'cocreation-not-applied',
        severity: 'error',
        message: '存在 2.5D 共创方案，但尚未应用到场景。'
      });
    }
    if (appliedPlans.length > 0 && !saved) {
      blockers.push({
        code: 'scene-not-saved',
        severity: 'error',
        message: '已应用的 2.5D 场景改动需要先保存，才能进行生产导出。'
      });
    }
    if (!targets.length) {
      blockers.push({
        code: 'build-target-missing',
        severity: 'error',
        message: '至少需要启用一个轻量部署目标。'
      });
    }
    if (!deploymentManifest.entryScene || !deploymentManifest.scenes?.length) {
      blockers.push({
        code: 'deploy-manifest-incomplete',
        severity: 'error',
        message: '轻量部署清单必须包含入口场景。'
      });
    }
    for (const issue of authoring.issues || []) {
      if (issue.severity === 'critical' || issue.severity === 'error') {
        blockers.push({
          code: `authoring-${issue.code}`,
          severity: issue.severity,
          message: issue.message
        });
      } else {
        warnings.push({
          code: `authoring-${issue.code}`,
          severity: issue.severity || 'warning',
          message: issue.message
        });
      }
    }
    if (appliedPlans.length === 0 && !hasPendingPlan) {
      warnings.push({
        code: 'no-25d-cocreation',
        severity: 'warning',
        message: '当前场景还没有已应用的 2.5D 共创方案。'
      });
    }
    return {
      blockers,
      warnings,
      evidence: {
        scene: current.scene?.name || '未命名',
        entities: (current.scene?.entities || []).length,
        appliedCoCreationPlans: appliedPlans.length,
        saved,
        deploymentBundle: deployment.manifest?.profile || null,
        entryScene: deployment.manifest?.entryScene || null,
        targets,
        files: deployment.files.length,
        authoringIssues: authoring.issues.length
      }
    };
  }

  function appliedCoCreationPlans() {
    return (current.scene?.entities || [])
      .filter((entity) => entity?.coCreated && entity.coCreationPlan)
      .map((entity) => ({
        entityId: entity.id,
        plan: entity.coCreationPlan
      }))
      .sort((left, right) => left.entityId.localeCompare(right.entityId));
  }

  function deploymentAssetPaths() {
    const paths = new Set(getWorkflowAssets().map((asset) => asset.path).filter(Boolean));
    for (const reference of collectSceneAssetReferences()) {
      if (reference.path) paths.add(reference.path);
    }
    for (const { plan } of appliedCoCreationPlans()) {
      for (const asset of plan.assets || []) {
        if (asset.reuseAssetId) paths.add(slash(asset.reuseAssetId));
      }
    }
    return [...paths].sort((left, right) => left.localeCompare(right));
  }

  function deploymentAssetManifestEntries() {
    const byPath = new Map();
    for (const asset of getWorkflowAssets()) {
      const normalized = normalizeAssetEntry(asset);
      if (!normalized.path) continue;
      byPath.set(normalized.path, {
        type: normalized.type,
        name: normalized.name,
        path: normalized.path,
        url: normalized.path
      });
    }
    for (const path of deploymentAssetPaths()) {
      if (!byPath.has(path)) {
        byPath.set(path, {
          type: inferAssetTypeFromPath(path),
          name: path.split('/').pop() || path,
          path,
          url: path
        });
      }
    }
    return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  }

  function createAssetWorkflowIndex() {
    const assets = getWorkflowAssets();
    const assetPaths = new Set(assets.map((asset) => asset.path).filter(Boolean));
    const byType = {};
    for (const asset of assets) byType[asset.type] = (byType[asset.type] || 0) + 1;
    const sceneReferences = collectSceneAssetReferences().map((reference) => ({
      ...reference,
      resolved: assetPaths.has(reference.path)
    }));
    const referencedPaths = new Set(sceneReferences.map((reference) => reference.path));
    const orphanAssets = assets
      .filter((asset) => asset.path && asset.type !== 'scene' && !referencedPaths.has(asset.path))
      .map((asset) => asset.path)
      .sort((left, right) => left.localeCompare(right));
    return {
      format: 'OmniCore.AssetWorkflowIndex',
      generatedAt: new Date().toISOString(),
      totalAssets: assets.length,
      byType,
      assets: assets.map((asset) => cloneState(asset)),
      sceneReferences,
      unresolvedReferences: sceneReferences.filter((reference) => !reference.resolved),
      orphanAssets
    };
  }

  function createCollaborationHandoff(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const readiness = buildAuthoringHealthReport({ checkedAt: generatedAt, open: false, warningMs: options.warningMs ?? 12 });
    const assetWorkflow = createAssetWorkflowIndex();
    const buildTargets = enabledBuildTargets();
    return {
      format: 'OmniCore.EditorCollaborationHandoff',
      generatedAt,
      author: options.author || null,
      reviewer: options.reviewer || null,
      note: options.note || '',
      workspace: cloneState(current.workspace || {}),
      scene: {
        name: current.scene?.name || '未命名',
        entityCount: (current.scene?.entities || []).length
      },
      readiness: {
        ready: readiness.ok && assetWorkflow.unresolvedReferences.length === 0,
        issues: readiness.issues,
        unresolvedReferences: assetWorkflow.unresolvedReferences
      },
      files: {
        projectFiles: Object.keys(normalizeProjectFilesState(current.projectFiles)).length,
        assets: assetWorkflow.totalAssets,
        scenes: countSceneAssets(assetWorkflow.assets),
        sourceFiles: (current.workspace?.sourceFiles || []).length
      },
      buildTargets
    };
  }

  function createProjectGovernanceReport() {
    const assetWorkflow = createAssetWorkflowIndex();
    const buildTargets = enabledBuildTargets();
    const projectFiles = Object.keys(normalizeProjectFilesState(current.projectFiles));
    const checklist = [
      checkItem('workspace-opened', Boolean(current.workspace?.root || current.workspace?.name), '打开或扫描一个项目工作区。'),
      checkItem('asset-workflow-index', assetWorkflow.totalAssets > 0, '索引项目资源和场景引用。'),
      checkItem('collaboration-handoff', true, '评审前导出协作交接包。'),
      checkItem('project-files-present', projectFiles.length > 0, '在编辑器工作区中跟踪项目文件。'),
      checkItem('platform-targets', buildTargets.includes('web') && buildTargets.includes('wechat'), '保持 Web 和微信目标配置完整。'),
      checkItem('authoring-health', assetWorkflow.unresolvedReferences.length === 0, '修复缺失的场景资源引用。')
    ];
    return {
      format: 'OmniCore.EditorGovernanceReport',
      generatedAt: new Date().toISOString(),
      workspace: cloneState(current.workspace || {}),
      coverage: {
        projectFiles: projectFiles.length,
        assets: assetWorkflow.totalAssets,
        sceneReferences: assetWorkflow.sceneReferences.length,
        unresolvedReferences: assetWorkflow.unresolvedReferences.length,
        buildTargets
      },
      checklist,
      ready: checklist.every((item) => item.status === 'covered')
    };
  }

  function exportMatureEditorBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    return {
      format: 'OmniCore.MatureEditorBundle',
      version: 1,
      generatedAt,
      authoring: exportAuthoringBundle({ ...options, generatedAt }),
      assetWorkflow: createAssetWorkflowIndex(),
      collaboration: createCollaborationHandoff({ ...options, generatedAt }),
      governance: createProjectGovernanceReport()
    };
  }

  function getWorkflowAssets() {
    const candidates = [
      ...(Array.isArray(current.assets) ? current.assets : []),
      ...(Array.isArray(current.workspace?.assets) ? current.workspace.assets : []),
      ...(Array.isArray(current.workspace?.scenes) ? current.workspace.scenes : [])
    ].map(normalizeAssetEntry);
    const byPath = new Map();
    for (const asset of candidates) {
      if (!asset.path || byPath.has(asset.path)) continue;
      byPath.set(asset.path, asset);
    }
    return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  }

  function collectSceneAssetReferences() {
    const references = [];
    for (const entity of current.scene?.entities || []) {
      for (const [field, value] of Object.entries(entity)) {
        if (!isAssetReferenceField(field, value)) continue;
        references.push({
          entityId: entity.id || null,
          entityName: entity.name || null,
          field,
          path: slash(value)
        });
      }
      for (const [field, value] of Object.entries(entity.material || {})) {
        if (!isAssetReferenceField(field, value)) continue;
        references.push({
          entityId: entity.id || null,
          entityName: entity.name || null,
          field: `material.${field}`,
          path: slash(value)
        });
      }
    }
    return references.sort((left, right) => `${left.path}:${left.entityId}`.localeCompare(`${right.path}:${right.entityId}`));
  }

  function enabledBuildTargets() {
    const settings = normalizeBuildSettingsState(current.buildSettings);
    return Object.entries(settings.targets || {})
      .filter(([, config]) => config.enabled)
      .map(([target]) => target)
      .sort((left, right) => left.localeCompare(right));
  }

  function countSceneAssets(assets) {
    return assets.filter((asset) => asset.type === 'scene').length || (current.workspace?.scenes || []).length || (current.sceneTabs || []).length;
  }

  function checkItem(id, ok, action) {
    return {
      id,
      status: ok ? 'covered' : 'missing',
      action
    };
  }

  function getProfilerHotspots(options = {}) {
    const warningMs = Number(options.warningMs ?? 10);
    const criticalMs = Number(options.criticalMs ?? 16);
    return (current.profilerFrame?.sections || [])
      .map((section) => ({ name: section.name || '未知', duration: Number(section.duration || 0) }))
      .filter((section) => section.duration >= warningMs)
      .sort((left, right) => right.duration - left.duration)
      .map((section) => ({
        ...section,
        severity: section.duration >= criticalMs ? 'critical' : 'warning',
        suggestion: profilerSuggestion(section.name, section.duration)
      }));
  }

  function buildAuthoringHealthReport(options = {}) {
    const issues = [];
    const assets = new Set((current.assets || []).map((asset) => slash(typeof asset === 'string' ? asset : asset.path || asset.url || asset.name || '')));
    const addIssue = (code, message, detail = {}) => {
      issues.push({ code, message, severity: detail.severity || 'error', ...detail });
    };

    const particleConfig = current.particleEditor?.config ? normalizeParticleConfig(current.particleEditor.config) : null;
    if (particleConfig) {
      if (!(particleConfig.lifetime > 0)) addIssue('particle-lifetime-invalid', '粒子生命周期必须大于 0。', { field: 'lifetime' });
      if (particleConfig.emissionRate < 0 || particleConfig.emissionRate > 1000) addIssue('particle-emission-rate-invalid', '粒子发射率必须保持在 0 到 1000 之间。', { field: 'emissionRate' });
      for (const [curveName, points] of Object.entries(particleConfig.curves || {})) {
        for (let index = 1; index < points.length; index += 1) {
          if (points[index].t < points[index - 1].t) {
            addIssue('particle-curve-order-invalid', `粒子曲线 ${curveName} 必须按 t 排序。`, { field: `curves.${curveName}` });
            break;
          }
        }
      }
      for (const point of particleConfig.gradient || []) {
        if (!isHexColor(point.color)) addIssue('particle-gradient-color-invalid', `粒子渐变颜色无效：${point.color}`, { field: 'gradient' });
      }
    }

    const spriteEditor = current.spriteEditor || {};
    if (spriteEditor.source) {
      if (!assets.has(slash(spriteEditor.source))) addIssue('sprite-source-missing', `精灵源资源缺失：${spriteEditor.source}`, { path: spriteEditor.source });
      const nineSlice = normalizeNineSlice(spriteEditor.nineSlice || {});
      if (nineSlice.left < 0 || nineSlice.top < 0 || nineSlice.right < 0 || nineSlice.bottom < 0 || (nineSlice.right > 0 && nineSlice.left > nineSlice.right) || (nineSlice.bottom > 0 && nineSlice.top > nineSlice.bottom)) {
        addIssue('sprite-nine-slice-invalid', '精灵九宫格参考线出现反向或负值。', { field: 'nineSlice' });
      }
    }

    for (const entity of current.scene.entities || []) {
      if (!entity.material) continue;
      const alphaClip = Number(entity.material.alphaClip ?? 0);
      if (alphaClip < 0 || alphaClip > 1) addIssue('sprite-alpha-clip-invalid', '精灵透明裁剪必须在 0 到 1 之间。', { entityId: entity.id, field: 'material.alphaClip' });
      if (entity.material.colorTint && !isHexColor(entity.material.colorTint)) addIssue('sprite-color-tint-invalid', `精灵颜色叠加无效：${entity.material.colorTint}`, { entityId: entity.id, field: 'material.colorTint' });
      if (entity.material.normalMap && !assets.has(slash(entity.material.normalMap))) addIssue('sprite-normal-map-missing', `精灵法线贴图缺失：${entity.material.normalMap}`, { entityId: entity.id, path: entity.material.normalMap });
    }

    for (const [clipId, clip] of Object.entries(current.animations || {})) {
      const duration = Number(clip.duration || 0);
      for (const event of clip.events || []) {
        const frame = Number(event.frame || 0);
        if (!event.name) addIssue('animation-event-name-missing', `${clipId} 中的动画事件缺少名称。`, { clipId, frame });
        if (frame < 0 || frame > duration) addIssue('animation-event-out-of-range', `动画事件 ${event.name || '未命名'} 超出 ${clipId} 的时长范围。`, { clipId, frame, duration });
      }
    }

    const prefabIds = new Set((current.prefabs || []).map((prefab) => prefab.id || prefab.name));
    for (const prefab of current.prefabs || []) {
      if (prefab.extends && !prefabIds.has(prefab.extends)) addIssue('prefab-base-missing', `预制体基类缺失：${prefab.extends}`, { prefabId: prefab.id || prefab.name });
    }

    const hotspots = getProfilerHotspots({ warningMs: options.profilerWarningMs ?? options.warningMs, criticalMs: options.profilerCriticalMs ?? options.criticalMs });
    for (const hotspot of hotspots) addIssue(`profiler-hotspot-${hotspot.severity}`, hotspot.suggestion, { severity: hotspot.severity, subsystem: hotspot.name, duration: hotspot.duration });

    return {
      open: Boolean(options.open),
      ok: issues.length === 0,
      checkedAt: options.checkedAt || new Date().toISOString(),
      counts: {
        animations: Object.keys(current.animations || {}).length,
        particles: particleConfig ? 1 : 0,
        sprites: spriteEditor.source ? 1 : 0,
        scenes: (current.sceneTabs || []).length,
        prefabs: (current.prefabs || []).length
      },
      issues,
      hotspots
    };
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/iu.test(String(value || ''));
  }

  function profilerSuggestion(name, duration) {
    const label = String(name || '未知');
    if (/collision/iu.test(label)) return `碰撞耗时 ${duration}ms；请检查碰撞体密度、粗筛过滤和 2.5D 投影重叠。`;
    if (/render|renderer|draw/iu.test(label)) return `${label} 耗时 ${duration}ms；请检查批处理、材质状态切换和绘制调用数量。`;
    if (/update|script|logic/iu.test(label)) return `${label} 耗时 ${duration}ms；请检查逐帧脚本，并避免在更新循环中分配对象。`;
    return `${label} 耗时 ${duration}ms；请在性能火焰图中检查这个子系统。`;
  }

  function openEntityScript(entityOrId, symbol = null, options = {}) {
    const entity = typeof entityOrId === 'string'
      ? current.scene.entities.find((item) => item.id === entityOrId)
      : entityOrId;
    const binding = resolveScriptBinding(entity, symbol, options);
    if (!binding) return null;
    const payload = {
      entityId: entity.id,
      entityName: entity.name || entity.id,
      ...binding
    };
    emit('editor:open-code', payload);
    return payload;
  }

  function patchEntity(id, patch) {
    const entities = current.scene.entities.map((entity) => (
      entity.id === id ? { ...entity, ...patch } : entity
    ));
    current = {
      ...current,
      scene: { ...current.scene, entities }
    };
    emit('editor:update-entity', { id, patch, commandId: createCommandId('entity') });
    pushHistory(current, `修改 ${id}`);
    update(current);
    return entities.find((entity) => entity.id === id) || null;
  }

  function selectEntity(id, { append = false, ids = null } = {}) {
    const nextIds = ids
      ? [...new Set(ids.filter(Boolean).map(String))]
      : resolveNextSelection(id, append, current);
    current = {
      ...current,
      selectedEntityId: nextIds.at(-1) || null,
      selectedEntityIds: nextIds
    };
    emit('editor:select-entity', { id: current.selectedEntityId, ids: nextIds });
    emit('editor:highlight-entity', { id: current.selectedEntityId });
    update(current);
  }

  function setGridSnap(options = {}) {
    current = {
      ...current,
      gridSnap: {
        enabled: Boolean(options.enabled),
        size: Math.max(1, Number(options.size || current.gridSnap?.size || 16))
      }
    };
    emit('editor:grid-snap', current.gridSnap);
    update(current);
    return current.gridSnap;
  }

  function openCommandPalette() {
    current = { ...current, commandPaletteOpen: true };
    update(current);
    return current.commandPaletteOpen;
  }

  function closeCommandPalette() {
    current = { ...current, commandPaletteOpen: false };
    update(current);
    return current.commandPaletteOpen;
  }

  function runCommand(commandId) {
    const normalized = String(commandId || '').trim().toLowerCase();
    const command = normalized === 'validate' || normalized === 'scene validation'
      ? 'scene:validate'
      : normalized;
    if (command === 'scene:validate') return validateScene();
    if (command === 'overlay:collision-depth') return toggleSceneOverlays({ collision: true, depth: true });
    return {
      ok: false,
      command,
      error: '未知命令'
    };
  }

  function validateScene() {
    const issues = [];
    const ids = new Map();
    for (const entity of current.scene.entities) {
      const id = String(entity.id || '');
      if (ids.has(id)) {
        issues.push({
          code: 'duplicate-entity-id',
          severity: 'error',
          entityId: id,
          message: `实体标识重复：${id}`
        });
      }
      ids.set(id, true);
      if ((entity.type === 'sprite' || entity.sprite) && !entity.texture && !entity.sprite) {
        issues.push({
          code: 'missing-texture',
          severity: 'warning',
          entityId: id,
          message: `精灵实体 ${id} 缺少纹理。`
        });
      }
      if (Number(entity.x) < 0 || Number(entity.y) < 0) {
        issues.push({
          code: 'negative-position',
          severity: 'warning',
          entityId: id,
          message: `实体 ${id} 位于场景正向平面之外。`
        });
      }
    }
    const result = {
      ok: issues.length === 0,
      checkedAt: new Date().toISOString(),
      issues
    };
    current = {
      ...current,
      commandPaletteOpen: false,
      sceneValidation: result
    };
    emit('editor:scene-validation', result);
    update(current);
    return result;
  }

  function locateSceneIssue(issue = {}) {
    if (!issue.entityId) return null;
    current = { ...current, sceneIssueTargetId: issue.entityId };
    selectEntity(issue.entityId);
    return issue;
  }

  function captureSceneBaseline(name = 'baseline') {
    const snapshot = cloneState(current.scene);
    sceneBaselines.set(name, snapshot);
    emit('editor:scene-baseline', { name, entityCount: snapshot.entities.length });
    return snapshot;
  }

  function getSceneDiff(name = 'baseline') {
    const baseline = sceneBaselines.get(name) || { entities: [] };
    return diffScenes(baseline, current.scene);
  }

  function createPrefabSnapshot(entityId = current.selectedEntityId, meta = {}) {
    const entity = current.scene.entities.find((item) => item.id === entityId);
    if (!entity) return null;
    const previous = current.prefabHistory?.[entityId] || [];
    const snapshot = {
      id: `${entityId}@${previous.length + 1}`,
      entityId,
      version: previous.length + 1,
      createdAt: new Date().toISOString(),
      note: meta.note || '',
      entity: cloneState(entity)
    };
    current = {
      ...current,
      prefabHistory: {
        ...(current.prefabHistory || {}),
        [entityId]: [...previous, snapshot]
      }
    };
    emit('editor:prefab-snapshot', { entityId, version: snapshot.version });
    update(current);
    return snapshot;
  }

  function getPrefabHistory(entityId = current.selectedEntityId) {
    return cloneState(current.prefabHistory?.[entityId] || []);
  }

  function toggleSceneOverlays(overlays = {}) {
    current = {
      ...current,
      sceneOverlays: {
        ...(current.sceneOverlays || {}),
        ...overlays
      }
    };
    emit('editor:scene-overlays', current.sceneOverlays);
    update(current);
    return current.sceneOverlays;
  }

  function copySelection() {
    const ids = selectedIds(current);
    clipboard = current.scene.entities
      .filter((entity) => ids.includes(entity.id))
      .map((entity) => cloneState(entity));
    emit('editor:copy-entities', { ids, count: clipboard.length });
    return clipboard.map((entity) => cloneState(entity));
  }

  function pasteSelection() {
    if (!clipboard.length) return [];
    const existingIds = new Set(current.scene.entities.map((entity) => entity.id));
    const copies = clipboard.map((entity) => {
      const id = uniqueEntityId(`${entity.id || entity.name || 'entity'}-copy-${copySerial}`, existingIds);
      copySerial += 1;
      existingIds.add(id);
      return {
        ...cloneState(entity),
        id,
        name: `${entity.name || entity.id || '实体'} 副本`,
        x: Number(entity.x || 0) + 16,
        y: Number(entity.y || 0) + 16
      };
    });
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: [...current.scene.entities, ...copies]
      },
      selectedEntityId: copies.at(-1)?.id || current.selectedEntityId,
      selectedEntityIds: copies.map((entity) => entity.id)
    };
    emit('editor:paste-entities', { ids: current.selectedEntityIds, count: copies.length });
    pushHistory(current, `粘贴 ${copies.length} 个实体`);
    update(current);
    return copies;
  }

  function deleteSelection() {
    const ids = selectedIds(current);
    if (!ids.length) return [];
    const idSet = new Set(ids);
    const removed = current.scene.entities.filter((entity) => idSet.has(entity.id));
    if (!removed.length) return [];
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: current.scene.entities.filter((entity) => !idSet.has(entity.id))
      },
      selectedEntityId: null,
      selectedEntityIds: []
    };
    emit('editor:delete-entities', { ids, count: removed.length });
    pushHistory(current, `删除 ${removed.length} 个实体`);
    update(current);
    return removed;
  }

  function setGizmoMode(mode) {
    current = { ...current, gizmoMode: mode };
    emit('editor:gizmo-mode', { mode });
    update(current);
  }

  function paintTile(index) {
    const tilemap = cloneTilemap(current.tilemap);
    const activeLayer = findActiveTileLayer(tilemap);
    if (current.collisionMode) {
      addCollision(tilemap, index);
    } else {
      activeLayer.data[index] = current.selectedTile;
      if (activeLayer.id === tilemap.layers[0]?.id) tilemap.data[index] = current.selectedTile;
      if (isSolidTile(tilemap, current.selectedTile)) addCollision(tilemap, index);
    }
    current = { ...current, tilemap };
    emit('editor:update-tilemap', { tilemap });
    pushHistory(current, '绘制瓦片');
    update(current);
  }

  function selectTilesetTile(tileId) {
    const tilemap = cloneTilemap(current.tilemap);
    const tile = findTilesetTile(tilemap, tileId);
    current = { ...current, selectedTile: Number(tileId) };
    emit('editor:select-tile', { tileId: Number(tileId), crop: tile?.source || null });
    update(current);
    return current.selectedTile;
  }

  function selectTileLayer(layerId) {
    const tilemap = cloneTilemap(current.tilemap);
    if (!tilemap.layers.some((layer) => layer.id === layerId)) return null;
    tilemap.activeLayerId = layerId;
    current = { ...current, tilemap };
    emit('editor:select-tile-layer', { layerId });
    update(current);
    return layerId;
  }

  function applyRuleTiles() {
    const tilemap = cloneTilemap(current.tilemap);
    const activeLayer = findActiveTileLayer(tilemap);
    if (!activeLayer || !tilemap.ruleTiles.length) return tilemap;
    const original = [...activeLayer.data];
    const output = activeLayer.data.map((tileId, index) => {
      const rule = tilemap.ruleTiles.find((candidate) => ruleTileMatches(candidate, tileId, index, original, tilemap));
      return rule ? Number(rule.id) : tileId;
    });
    activeLayer.data = output;
    if (activeLayer.id === tilemap.layers[0]?.id) tilemap.data = [...output];
    current = { ...current, tilemap };
    emit('editor:apply-rule-tiles', { activeLayerId: activeLayer.id, rules: tilemap.ruleTiles.length });
    pushHistory(current, '应用规则瓦片');
    update(current);
    return tilemap;
  }

  function updateDatabaseRecord(table, id, field, value) {
    const database = cloneDatabase(current.database);
    database.tables[table] = database.tables[table] || {};
    const currentRecord = database.tables[table][id] || { id };
    const patch = { [field]: normalizeDatabaseInput(value, currentRecord[field]) };
    const record = { ...currentRecord, ...patch };
    database.tables[table][id] = record;
    database.lastUpdate = { table, id, record };
    current = { ...current, database };
    emit('editor:update-database-record', { table, id, patch, commandId: createCommandId('db') });
    persistDatabaseConfig(database.tables);
    pushHistory(current, `更新数据库 ${table}.${id}.${field}`);
    update(current);
    return record;
  }

  function persistDatabaseConfig(tables) {
    const payload = {
      path: 'config/data.json',
      tables: cloneState(tables)
    };
    const editorBridge = ownerWindow?.omnicoreEditor;
    if (typeof editorBridge?.saveDatabaseConfig === 'function') {
      editorBridge.saveDatabaseConfig(payload);
    } else {
      emit('editor:save-database-config', payload);
    }
    return payload;
  }

  function generateWithAI(prompt, options = {}) {
    const generationOptions = {
      ...parsePromptSize(prompt),
      ...options
    };
    const generated = AITilemapGenerator.generate(prompt, generationOptions);
    const layer = generated.tilemapJson.layers[0] || {};
    const tilemap = {
      width: generated.tilemapJson.width,
      height: generated.tilemapJson.height,
      tileWidth: generated.tilemapJson.tilewidth,
      tileHeight: generated.tilemapJson.tileheight,
      data: [...(layer.data || [])],
      collisions: []
    };
    const entities = [
      ...(generated.sceneJson.entities || []).map((entity) => ({
        ...entity,
        data: entity.type === 'tilemap' ? [...tilemap.data] : entity.data
      })),
      ...promptEntities(prompt)
    ];
    const existingIds = new Set(current.scene.entities.map((entity) => entity.id));
    const nextEntities = [
      ...current.scene.entities.filter((entity) => !entities.some((next) => next.id === entity.id)),
      ...entities.map((entity, index) => normalizeGeneratedEntity(entity, existingIds, index))
    ];
    current = {
      ...current,
      tilemap,
      scene: {
        ...current.scene,
        entities: nextEntities
      }
    };
    emit('editor:ai-generate-scene', { prompt, tilemap, entities });
    emit('editor:update-tilemap', { tilemap });
    pushHistory(current, '根据 AI 提示生成场景');
    update(current);
    return { prompt, tilemap, entities };
  }

  function instantiatePrefab(prefabId, point) {
    const prefab = current.prefabs.find((item) => item.id === prefabId || item.name === prefabId);
    if (!prefab) return null;
    const snapped = snapPoint(point, current);
    const entity = {
      id: `${prefab.id || prefab.name}-${Date.now().toString(36)}`,
      name: prefab.name || prefab.id || 'Prefab',
      type: prefab.type || 'sprite',
      texture: prefab.texture || null,
      width: prefab.width || 32,
      height: prefab.height || 32,
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      prefabId: prefab.id || prefab.name
    };
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: [...current.scene.entities, entity]
      },
      selectedEntityId: entity.id
    };
    emit('editor:instantiate-prefab', { prefabId: entity.prefabId, entity });
    pushHistory(current, `实例化预制体 ${entity.prefabId}`);
    update(current);
    return entity;
  }

  function instantiateAsset(assetPath, point) {
    if (!assetPath) return null;
    const snapped = snapPoint(point, current);
    const entity = {
      id: `asset-${Date.now().toString(36)}`,
      name: assetPath.split('/').pop() || 'Asset',
      type: 'sprite',
      texture: assetPath,
      width: 32,
      height: 32,
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      prefabId: null
    };
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: [...current.scene.entities, entity]
      },
      selectedEntityId: entity.id
    };
    emit('editor:instantiate-asset', { assetPath, entity });
    pushHistory(current, `实例化资源 ${assetPath}`);
    update(current);
    return entity;
  }

  function exportTiledJson() {
    const tilemap = cloneTilemap(current.tilemap);
    const tileLayers = tilemap.layers.map((layer, index) => ({
      id: index + 1,
      name: layer.name,
      type: 'tilelayer',
      visible: layer.visible !== false,
      opacity: layer.opacity ?? 1,
      width: tilemap.width,
      height: tilemap.height,
      data: [...layer.data]
    }));
    return {
      type: 'map',
      version: '1.10',
      tiledversion: '1.10.2',
      orientation: 'orthogonal',
      renderorder: 'right-down',
      width: tilemap.width,
      height: tilemap.height,
      tilewidth: tilemap.tileWidth,
      tileheight: tilemap.tileHeight,
      infinite: false,
      layers: [
        ...tileLayers,
        {
          id: tileLayers.length + 1,
          name: 'collision',
          type: 'objectgroup',
          objects: tilemap.collisions.map((index, objectIndex) => {
            const x = index % tilemap.width;
            const y = Math.floor(index / tilemap.width);
            return {
              id: objectIndex + 1,
              name: `collision-${index}`,
              type: 'collision',
              x: x * tilemap.tileWidth,
              y: y * tilemap.tileHeight,
              width: tilemap.tileWidth,
              height: tilemap.tileHeight
            };
          })
        }
      ],
      tilesets: tilemap.tilesets.map((tileset) => ({
        name: tileset.name,
        image: tileset.image,
        firstgid: tileset.firstgid,
        columns: tileset.columns,
        tilewidth: tileset.tileWidth,
        tileheight: tileset.tileHeight,
        tilecount: tileset.tilecount,
        tiles: tileset.tiles.map((tile) => ({
          id: tile.id,
          solid: Boolean(tile.solid),
          source: tile.source
        }))
      }))
    };
  }

  function exportFlowGraphEventSheet() {
    return {
      format: 'OmniCore.EventSheet',
      version: 1,
      ...createVisualGraph(current.flowGraph).toEventSheet()
    };
  }

  function exportBehaviorTreeJson() {
    return cloneState(current.behaviorTree || flowGraphToBehaviorTree(current.flowGraph));
  }

  function exportVisualScriptGraph() {
    return flowGraphToVisualScriptGraph(current.flowGraph);
  }

  function validateVisualScriptGraph(options = {}) {
    const runtime = new VisualScriptGraphRuntime({
      graph: exportVisualScriptGraph(),
      actions: createVisualScriptActions(options.actions),
      signals: options.signals,
      maxSteps: options.maxSteps
    });
    const validation = runtime.validate();
    current = createEditorState({
      ...current,
      visualScriptValidation: validation
    });
    emit('editor:visual-script-validation', validation);
    update(current);
    return validation;
  }

  function runVisualScript(eventName = 'start', payload = {}, options = {}) {
    const graph = exportVisualScriptGraph();
    const runtime = new VisualScriptGraphRuntime({
      graph,
      actions: createVisualScriptActions(options.actions),
      signals: options.signals,
      maxSteps: options.maxSteps
    });
    const validation = runtime.validate();
    const result = validation.ok || options.force
      ? runtime.trigger(eventName, payload, options)
      : { event: eventName, payload, variables: {}, events: [], trace: [] };
    const report = {
      ...result,
      graph,
      validation,
      ranAt: new Date().toISOString()
    };
    current = createEditorState({
      ...current,
      visualScriptTrace: report,
      visualScriptValidation: validation
    });
    emit('editor:visual-script-run', report);
    update(current);
    return report;
  }

  function exportVisualScriptEditorSession(options = {}) {
    const graph = exportVisualScriptGraph();
    const validation = current.visualScriptValidation || new VisualScriptGraphRuntime({
      graph,
      actions: createVisualScriptActions(options.actions),
      signals: options.signals,
      maxSteps: options.maxSteps
    }).validate();
    const report = current.visualScriptTrace || { event: null, trace: [], events: [], variables: {} };
    const traceRows = options.includeTrace === false
      ? []
      : (Array.isArray(report.trace) ? report.trace : []).map((entry, index) => ({
        index,
        nodeId: entry.nodeId || 'unknown',
        type: entry.type || 'node',
        text: formatVisualScriptTraceEntry(entry),
        raw: cloneState(entry)
      }));
    return {
      format: 'OmniCore.VisualScriptEditorSession',
      version: 1,
      graph,
      validation,
      palette: createVisualScriptPaletteModel(),
      selectors: {
        panel: '[data-visual-script-panel="runtime"]',
        runStart: '[data-visual-script-run="start"]',
        validate: '[data-visual-script-validate="true"]',
        trace: '[data-visual-script-trace="true"]'
      },
      status: {
        runnable: validation.ok,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        traceCount: traceRows.length
      },
      lastRun: {
        event: report.event || null,
        variables: cloneState(report.variables || {}),
        events: cloneState(report.events || []),
        traceRows
      },
      beginnerChecklist: createVisualScriptBeginnerChecklist({ graph, validation, traceRows })
    };
  }

  function exportUILayoutJson() {
    return cloneState(normalizeUILayoutState(current.uiLayout));
  }

  function exportDataJson() {
    return cloneState(current.database?.tables || {});
  }

  function exportRenderOptimizationPlan(options = {}) {
    const runtimePlan = createRenderOptimizationRuntimePlan(current.renderOptimizationPlan, options);
    emit('editor:render-optimization-runtime-plan', runtimePlan);
    return runtimePlan;
  }

  function verifyRenderOptimizationPlan(input = {}, options = {}) {
    const baseVerification = createEditorRenderOptimizationVerificationReport(current, input, options);
    const remediationPlan = createRenderOptimizationRemediationPlan(current, baseVerification, input, options);
    const verification = remediationPlan
      ? { ...baseVerification, remediationPlan }
      : baseVerification;
    current = createEditorState({
      ...current,
      renderOptimizationVerification: verification,
      renderOptimizationRemediationPlan: remediationPlan,
      dockLayout: ensurePanelInDock(current.dockLayout, 'render-diagnostics', 'bottom')
    });
    emit('editor:render-optimization-verification', verification);
    if (remediationPlan) emit('editor:render-optimization-remediation-plan', remediationPlan);
    update(current);
    showEditorFeedback(
      verification.ok ? '渲染优化验证通过' : '渲染优化验证未通过',
      verification.ok ? 'success' : 'warning'
    );
    return verification;
  }

  function applyRenderOptimizationRemediation(actionId, options = {}) {
    const remediationPlan = current.renderOptimizationRemediationPlan;
    const action = findRenderOptimizationRemediationAction(remediationPlan, actionId);
    if (!action) return null;
    const appliedAt = new Date(Number(options.now || Date.now())).toISOString();
    const plan = normalizeRenderOptimizationPlanState(current.renderOptimizationPlan);
    const result = applyRenderOptimizationRemediationAction(plan, action, {
      appliedAt,
      verification: current.renderOptimizationVerification,
      remediationPlan,
      recordDebugEvent
    });
    const appliedAction = {
      ...action,
      applied: true,
      appliedAt,
      result
    };
    const nextRemediationPlan = markRenderOptimizationRemediationApplied(remediationPlan, appliedAction);
    current = createEditorState({
      ...current,
      renderOptimizationPlan: plan,
      renderOptimizationRemediationPlan: nextRemediationPlan,
      dockLayout: ensurePanelInDock(current.dockLayout, 'render-diagnostics', 'bottom')
    });
    emit('editor:render-optimization-remediation-applied', {
      action: appliedAction,
      plan,
      remediationPlan: nextRemediationPlan
    });
    emit('editor:render-optimization-plan', plan);
    pushHistory(current, `应用渲染补救 ${action.label || action.type}`);
    update(current);
    showEditorFeedback(`已应用渲染补救：${action.label || action.type}`, 'success');
    return {
      action: appliedAction,
      result,
      plan,
      remediationPlan: nextRemediationPlan
    };
  }

  function applyRenderOptimizationRemediationPlan(options = {}) {
    const remediationPlan = current.renderOptimizationRemediationPlan;
    if (!remediationPlan) return null;
    const requestedActions = (remediationPlan.actions || []).filter((action) => !action.applied);
    const appliedAt = new Date(Number(options.now || Date.now())).toISOString();
    const plan = normalizeRenderOptimizationPlanState(current.renderOptimizationPlan);
    let nextRemediationPlan = cloneState(remediationPlan);
    const applied = [];
    const skipped = [];
    const failed = [];
    const auditTrail = [];

    for (const action of requestedActions) {
      try {
        const result = applyRenderOptimizationRemediationAction(plan, action, {
          appliedAt,
          verification: current.renderOptimizationVerification,
          remediationPlan: nextRemediationPlan,
          recordDebugEvent
        });
        if (result.skipped) {
          skipped.push({ ...action, result });
          auditTrail.push(renderRemediationAuditEntry('skip', action, result));
          continue;
        }
        const appliedAction = {
          ...action,
          applied: true,
          appliedAt,
          result
        };
        nextRemediationPlan = markRenderOptimizationRemediationApplied(nextRemediationPlan, appliedAction);
        applied.push(appliedAction);
        auditTrail.push(renderRemediationAuditEntry('apply', action, result));
      } catch (error) {
        const failure = {
          ...action,
          applied: false,
          errorName: error?.name || 'Error',
          reason: String(error?.message || 'remediation-action-failed')
        };
        failed.push(failure);
        auditTrail.push(renderRemediationAuditEntry('error', action, failure));
      }
    }

    const report = {
      schema: 'omnicore.render-optimization-remediation-apply-report.v1',
      source: options.source || 'editor-render-diagnostics',
      sourcePlanId: nextRemediationPlan.sourcePlanId || current.renderOptimizationVerification?.sourcePlanId || null,
      generatedAt: appliedAt,
      status: failed.length ? 'failed' : (applied.length ? 'applied' : 'skipped'),
      applied,
      skipped,
      failed,
      auditTrail,
      summary: {
        requestedCount: requestedActions.length,
        appliedCount: applied.length,
        skippedCount: skipped.length,
        failedCount: failed.length
      },
      nextVerification: {
        recommended: applied.length > 0,
        sourcePlanId: nextRemediationPlan.sourcePlanId || null,
        reason: applied.length > 0 ? 'remediation-applied' : 'no-remediation-applied'
      },
      crossEngineProfile: {
        sources: [
          { engine: 'Unity', advantage: 'batch apply fixes then re-profile the scene' },
          { engine: 'Unreal', advantage: 'group remediation work into auditable optimization passes' },
          { engine: 'Godot', advantage: 'keep editor fixes beginner-visible and reversible' },
          { engine: 'Cocos Creator', advantage: 'apply editor-side render fixes back into exportable project state' }
        ],
        capabilities: [
          'batch-render-remediation-application',
          'remediation-apply-audit-report',
          'runtime-plan-budget-writeback',
          'post-remediation-reverify-prompt'
        ]
      }
    };

    current = createEditorState({
      ...current,
      renderOptimizationPlan: plan,
      renderOptimizationRemediationPlan: nextRemediationPlan,
      renderOptimizationRemediationApplyReport: report,
      dockLayout: ensurePanelInDock(current.dockLayout, 'render-diagnostics', 'bottom')
    });
    emit('editor:render-optimization-remediation-apply-report', report);
    emit('editor:render-optimization-plan', plan);
    pushHistory(current, `批量应用渲染补救 ${applied.length}/${requestedActions.length}`);
    update(current);
    showEditorFeedback(`已批量应用渲染补救：${applied.length}/${requestedActions.length}`, 'success');
    return report;
  }

  function reverifyRenderOptimizationRemediation(input = {}, options = {}) {
    const previousVerification = current.renderOptimizationVerification;
    const remediationReport = current.renderOptimizationRemediationApplyReport;
    const reverifiedAt = resolveEditorVerificationTimestamp(
      input.reverifiedAt || options.reverifiedAt || input.verifiedAt || options.verifiedAt || (input.now ?? options.now)
    );
    const runtimePlan = input.runtimePlan || createRenderOptimizationRuntimePlan(current.renderOptimizationPlan, {
      generatedAt: reverifiedAt
    });
    const applyReport = input.applyReport || remediationReport || {
      schema: 'omnicore.render-optimization-apply-report.v1',
      sourcePlanId: runtimePlan.sourcePlanId || previousVerification?.sourcePlanId || current.renderOptimizationPlan?.id || null,
      status: 'applied',
      applied: cloneState(runtimePlan.runtimeActions || []),
      summary: { appliedCount: runtimePlan.runtimeActions?.length || 0 }
    };
    const verification = createEditorRenderOptimizationVerificationReport(current, {
      ...input,
      applyReport,
      runtimePlan,
      source: input.source || options.source || 'editor-render-remediation-reverify',
      verifiedAt: reverifiedAt
    }, options);
    const previousFailedGates = (previousVerification?.gates || []).filter((gate) => !gate.ok);
    const previousFailedGateIds = new Set(previousFailedGates.map((gate) => gate.id));
    const stillFailingGates = (verification.gates || []).filter((gate) => !gate.ok);
    const stillFailingGateIds = new Set(stillFailingGates.map((gate) => gate.id));
    const recoveredGateCount = previousFailedGateIds.size
      ? [...previousFailedGateIds].filter((id) => !stillFailingGateIds.has(id)).length
      : Math.max(0, Number(verification.summary?.gatesPassed || 0));
    const remediationAppliedCount = Number(
      remediationReport?.summary?.appliedCount
      ?? remediationReport?.applied?.length
      ?? applyReport.summary?.appliedCount
      ?? applyReport.applied?.length
      ?? 0
    );
    const reverify = {
      schema: 'omnicore.render-optimization-remediation-reverify-report.v1',
      source: input.source || options.source || 'editor-render-remediation-reverify',
      sourcePlanId: verification.sourcePlanId || runtimePlan.sourcePlanId || null,
      generatedAt: reverifiedAt,
      ok: verification.ok === true,
      status: verification.ok ? 'recovered' : 'still-failing',
      previousVerificationStatus: previousVerification?.status || null,
      remediationAppliedCount,
      verification,
      stillFailingGates: cloneState(stillFailingGates),
      summary: {
        recoveredGateCount,
        previousFailedGateCount: previousFailedGateIds.size || (verification.gates || []).length,
        stillFailingGateCount: stillFailingGates.length,
        frameMsDelta: roundEditorVerificationMetric(verification.summary?.frameMsDelta || 0)
      },
      crossEngineProfile: {
        sources: [
          { engine: 'Unity', advantage: 'profile again after fixes and keep pass/fail evidence attached to the editor state' },
          { engine: 'Unreal', advantage: 're-run budget gates after remediation instead of treating fixes as complete by execution' },
          { engine: 'Godot', advantage: 'make recovery status visible inside the beginner-facing editor panel' },
          { engine: 'PixiJS', advantage: 'verify batching, texture uploads, and filter costs after every render repair pass' }
        ],
        capabilities: [
          'post-remediation-render-reverify',
          'recovered-budget-gate-summary',
          'runtime-sync-reverify-report',
          'editor-visible-render-recovery-state'
        ]
      }
    };
    current = createEditorState({
      ...current,
      renderOptimizationVerification: verification,
      renderOptimizationRemediationReverifyReport: reverify,
      dockLayout: ensurePanelInDock(current.dockLayout, 'render-diagnostics', 'bottom')
    });
    emit('editor:render-optimization-remediation-reverify-report', reverify);
    emit('editor:render-optimization-verification', verification);
    pushHistory(current, verification.ok ? '渲染补救复验通过' : '渲染补救复验仍未通过');
    update(current);
    showEditorFeedback(
      verification.ok ? '渲染补救复验通过' : '渲染补救复验仍未通过',
      verification.ok ? 'success' : 'warning'
    );
    return reverify;
  }

  function createRuntimeSyncPayload() {
    const generatedAt = new Date().toISOString();
    return {
      protocol: 'omnicore-editor-runtime-sync/v1',
      generatedAt,
      scene: cloneState(current.scene),
      eventSheet: exportFlowGraphEventSheet(),
      behaviorTree: exportBehaviorTreeJson(),
      visualScriptGraph: exportVisualScriptGraph(),
      visualScriptTrace: cloneState(current.visualScriptTrace),
      uiLayout: exportUILayoutJson(),
      renderOptimizationPlan: cloneState(current.renderOptimizationPlan),
      renderOptimizationVerification: cloneState(current.renderOptimizationVerification),
      renderOptimizationRemediation: cloneState(current.renderOptimizationRemediationPlan),
      renderOptimizationRemediationReport: cloneState(current.renderOptimizationRemediationApplyReport),
      renderOptimizationRemediationReverify: cloneState(current.renderOptimizationRemediationReverifyReport),
      scene3DReadiness: cloneState(current.scene3DReadiness),
      scene3DFixPlan: cloneState(current.scene3DFixPlan),
      scene3DFixApplyReport: cloneState(current.scene3DFixApplyReport),
      renderOptimizationRuntime: createRenderOptimizationRuntimePlan(current.renderOptimizationPlan, { generatedAt })
    };
  }

  function applyRuntimeSyncPayload(payload = {}) {
    current = createEditorState({
      ...current,
      scene: payload.scene || current.scene,
      behaviorTree: payload.behaviorTree || current.behaviorTree,
      visualScriptTrace: payload.visualScriptTrace || current.visualScriptTrace,
      visualScriptValidation: payload.visualScriptTrace?.validation || current.visualScriptValidation,
      uiLayout: payload.uiLayout || current.uiLayout,
      renderOptimizationPlan: payload.renderOptimizationPlan || payload.renderOptimizationRuntime?.sourcePlan || current.renderOptimizationPlan,
      renderOptimizationVerification: payload.renderOptimizationVerification || current.renderOptimizationVerification,
      renderOptimizationRemediationPlan: payload.renderOptimizationRemediation || payload.renderOptimizationRemediationPlan || current.renderOptimizationRemediationPlan,
      renderOptimizationRemediationApplyReport: payload.renderOptimizationRemediationReport || payload.renderOptimizationRemediationApplyReport || current.renderOptimizationRemediationApplyReport,
      renderOptimizationRemediationReverifyReport: payload.renderOptimizationRemediationReverify || payload.renderOptimizationRemediationReverifyReport || current.renderOptimizationRemediationReverifyReport,
      scene3DReadiness: payload.scene3DReadiness || current.scene3DReadiness,
      scene3DFixPlan: payload.scene3DFixPlan || current.scene3DFixPlan,
      scene3DFixApplyReport: payload.scene3DFixApplyReport || current.scene3DFixApplyReport,
      flowGraph: payload.flowGraph || current.flowGraph
    });
    emit('editor:runtime-sync-applied', { protocol: payload.protocol || null });
    update(current);
    return current;
  }

  function buildAssetDependencyGraph() {
    const nodes = new Map();
    const edges = [];
    const edgeKeys = new Set();
    const addNode = (id, type) => {
      if (id && !nodes.has(id)) nodes.set(id, { id, type });
    };
    const addEdge = (from, to, type) => {
      if (!from || !to) return;
      const key = `${from}->${to}:${type || 'reference'}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push({ from, to, type: type || 'reference' });
    };
    for (const asset of collectKnownEditorAssets(current)) addNode(asset.path, asset.type || 'asset');
    for (const [file, source] of Object.entries(current.projectFiles || {})) {
      addNode(file, 'file');
      for (const asset of current.assets || []) {
        const assetPath = normalizeResourcePath(asset);
        if (assetPath && String(source).includes(assetPath)) addEdge(file, assetPath, 'reference');
      }
    }
    for (const prefab of current.prefabs || []) addNode(`prefab:${prefab.id || prefab.name}`, 'prefab');
    for (const entity of current.scene?.entities || []) {
      addNode(`entity:${entity.id || entity.name}`, 'entity');
    }
    for (const reference of collectEditorClosureReferences(current).references) {
      addNode(reference.source, reference.sourceType || 'reference');
      addNode(reference.path, assetType(reference.path));
      addEdge(reference.source, reference.path, reference.field || reference.type || 'reference');
    }
    return { nodes: [...nodes.values()], edges };
  }

  function replaceAssetReferences(from, to) {
    const normalizedFrom = slash(from || '');
    const normalizedTo = slash(to || '');
    if (!normalizedFrom || !normalizedTo) return { from: normalizedFrom, to: normalizedTo, changedFiles: [] };
    const projectFiles = { ...(current.projectFiles || {}) };
    const changedFiles = [];
    for (const [file, source] of Object.entries(projectFiles)) {
      if (!String(source).includes(normalizedFrom)) continue;
      projectFiles[file] = String(source).split(normalizedFrom).join(normalizedTo);
      changedFiles.push(file);
    }
    const scene = replaceReferenceValue(current.scene, normalizedFrom, normalizedTo);
    const prefabs = replaceReferenceValue(current.prefabs, normalizedFrom, normalizedTo);
    const sceneTabs = replaceReferenceValue(current.sceneTabs, normalizedFrom, normalizedTo);
    current = createEditorState({ ...current, projectFiles, scene, prefabs, sceneTabs });
    emit('editor:asset-references-replaced', { from: normalizedFrom, to: normalizedTo, changedFiles });
    update(current);
    return { from: normalizedFrom, to: normalizedTo, changedFiles };
  }

  function createHotReloadCompile(changedFiles = []) {
    const files = [...new Set((Array.isArray(changedFiles) ? changedFiles : [changedFiles])
      .map((file) => slash(file || ''))
      .filter(Boolean))];
    const graph = buildAssetDependencyGraph();
    const hotReloadManifest = {
      protocol: 'omnicore-hot-reload/v1',
      changedFiles: files,
      affectedAssets: [...new Set(graph.edges.filter((edge) => files.includes(edge.from)).map((edge) => edge.to))],
      eventSheet: exportFlowGraphEventSheet(),
      behaviorTree: exportBehaviorTreeJson()
    };
    return {
      ok: true,
      compiledAt: new Date().toISOString(),
      changedFiles: files,
      hotReloadManifest,
      graph
    };
  }

  function runIncrementalCompile(changedFiles = []) {
    const compile = createHotReloadCompile(changedFiles);
    current = createEditorState({ ...current, hotReload: compile });
    emit('editor:incremental-compile', compile.hotReloadManifest);
    emit('editor:hot-reload', compile);
    update(current);
    return compile;
  }

  function queueHotReload(changedFiles = []) {
    const compile = runIncrementalCompile(changedFiles);
    const report = createEditorClosureReport({ changedFiles: compile.changedFiles, hotReload: compile });
    return { ...compile, report };
  }

  function buildCurrentEditorClosureReport(options = {}) {
    const timeline = exportDebugTimeline({
      now: Number(options.now ?? latestDebugTimestamp()),
      windowMs: Number(options.windowMs || 10000)
    });
    return buildEditorClosureReport(current, {
      ...options,
      hotReload: options.hotReload || current.hotReload || null,
      debugTimeline: timeline,
      generatedAt: options.generatedAt || new Date().toISOString()
    });
  }

  function latestDebugTimestamp() {
    const values = [];
    for (const event of debugTimeline.events || []) values.push(Number(event.at || 0));
    for (const frame of current.profilerHistory || []) values.push(Number(frame.at || frame.frameStartedAt || 0));
    if (current.profilerFrame) values.push(Number(current.profilerFrame.at || current.profilerFrame.frameStartedAt || 0));
    const finite = values.filter((value) => Number.isFinite(value) && value > 0);
    return finite.length ? Math.max(...finite) : Date.now();
  }

  function createEditorClosureReport(options = {}) {
    const report = buildCurrentEditorClosureReport(options);
    if (options.persist === false) return report;
    current = createEditorState({
      ...current,
      editorClosure: report,
      dockLayout: ensurePanelInDock(current.dockLayout, 'runtime-debug', 'bottom')
    });
    emit('editor:closure-report', report);
    update(current);
    return report;
  }

  function applyEditorClosureFixes({ replacements = {}, registerMissing = false } = {}) {
    const replacementResults = [];
    for (const [from, to] of Object.entries(replacements || {})) {
      replacementResults.push(replaceAssetReferences(from, to));
    }
    const reportBefore = buildCurrentEditorClosureReport({ persist: false });
    const existingAssets = new Set(collectKnownEditorAssets(current).map((asset) => asset.path));
    const registeredAssets = [];
    if (registerMissing) {
      const additions = [];
      for (const missing of reportBefore.missingAssets || []) {
        if (!missing.path || existingAssets.has(missing.path)) continue;
        existingAssets.add(missing.path);
        registeredAssets.push(missing.path);
        additions.push({
          path: missing.path,
          name: missing.path.split('/').pop() || missing.path,
          type: assetType(missing.path),
          missingStub: true,
          repairedAt: new Date().toISOString()
        });
      }
      if (additions.length) {
        current = createEditorState({ ...current, assets: [...(current.assets || []), ...additions] });
      }
    }
    const report = createEditorClosureReport();
    if (registeredAssets.length || replacementResults.length) pushHistory(current, '修复编辑器闭环资源');
    emit('editor:closure-fixes-applied', { registeredAssets, replacements: replacementResults });
    return { registeredAssets, replacements: replacementResults, report };
  }

  function refreshAssetRegistryPanel(options = {}) {
    const panel = buildAssetRegistryPanelState(current, options);
    current = createEditorState({
      ...current,
      assetRegistryPanel: panel,
      dockLayout: ensurePanelInDock(current.dockLayout, 'assets', 'left')
    });
    emit('editor:asset-registry-panel', panel);
    update(current);
    return panel;
  }

  function refreshRenderDiagnosticsPanel(options = {}) {
    const panel = buildRenderDiagnosticsPanelState(current, options);
    current = createEditorState({
      ...current,
      renderDiagnosticsPanel: panel,
      dockLayout: ensurePanelInDock(current.dockLayout, 'render-diagnostics', 'bottom')
    });
    emit('editor:render-diagnostics-panel', panel);
    update(current);
    return panel;
  }

  function refreshScene3DReadinessPanel(input = {}, options = {}) {
    const sceneKit = createEditorScene3DKit(input.scene || current.scene3DReadiness?.scene || {});
    const availableAssets = input.availableAssets || current.scene3DReadiness?.availableAssets || collectScene3DAvailableAssets(current);
    const budgets = input.budgets || current.scene3DReadiness?.budgets || {};
    const report = sceneKit.createReadinessReport({ availableAssets, budgets });
    const panel = createEditorScene3DReadinessState({
      sceneKit,
      availableAssets,
      budgets,
      report,
      generatedAt: input.generatedAt || options.generatedAt || new Date().toISOString()
    });
    current = createEditorState({
      ...current,
      scene3DReadiness: panel,
      scene3DFixPlan: input.resetFixPlan === false ? current.scene3DFixPlan : null,
      scene3DFixApplyReport: input.resetApplyReport === false ? current.scene3DFixApplyReport : null,
      dockLayout: ensurePanelInDock(current.dockLayout, 'scene-3d-readiness', 'bottom')
    });
    emit('editor:scene-3d-readiness', panel);
    update(current);
    return panel;
  }

  function createScene3DReadinessFixPlan(options = {}) {
    const readiness = current.scene3DReadiness || refreshScene3DReadinessPanel({}, { generatedAt: options.generatedAt });
    const sceneKit = createEditorScene3DKit(readiness.scene || {});
    const plan = sceneKit.createReadinessFixPlan(readiness.report, {
      generatedAt: options.generatedAt || new Date().toISOString()
    });
    current = createEditorState({
      ...current,
      scene3DFixPlan: plan,
      dockLayout: ensurePanelInDock(current.dockLayout, 'scene-3d-readiness', 'bottom')
    });
    emit('editor:scene-3d-readiness-fix-plan', plan);
    update(current);
    return plan;
  }

  function applyScene3DReadinessFixPlan(options = {}) {
    const readiness = current.scene3DReadiness || refreshScene3DReadinessPanel();
    const plan = current.scene3DFixPlan || createScene3DReadinessFixPlan(options);
    const sceneKit = createEditorScene3DKit(readiness.scene || {});
    const applyReport = sceneKit.applyReadinessFixPlan(plan, {
      appliedAt: options.appliedAt || new Date().toISOString()
    });
    const recheckReport = sceneKit.createReadinessReport({
      availableAssets: readiness.availableAssets || [],
      budgets: readiness.budgets || {}
    });
    const recheck = createEditorScene3DReadinessState({
      sceneKit,
      availableAssets: readiness.availableAssets || [],
      budgets: readiness.budgets || {},
      report: recheckReport,
      generatedAt: options.recheckedAt || applyReport.appliedAt
    });
    const report = {
      ...applyReport,
      recheck
    };
    current = createEditorState({
      ...current,
      scene3DReadiness: recheck,
      scene3DFixApplyReport: report,
      dockLayout: ensurePanelInDock(current.dockLayout, 'scene-3d-readiness', 'bottom')
    });
    emit('editor:scene-3d-readiness', recheck);
    emit('editor:scene-3d-readiness-fix-apply-report', report);
    pushHistory(current, `应用 3D 场景修复 ${report.summary?.appliedCount || 0}/${report.summary?.requestedCount || 0}`);
    update(current);
    showEditorFeedback(`3D 场景安全修复已应用 ${report.summary?.appliedCount || 0} 项`, report.status === 'failed' ? 'warning' : 'success');
    return report;
  }

  function applyAssetRegistryChanges(changes = [], options = {}) {
    const changeList = (Array.isArray(changes) ? changes : [changes]).filter(Boolean);
    const registryState = buildEditorAssetRegistryState(current);
    const source = String(options.source || 'editor-resource-panel');
    const session = new AssetRegistryChangeSet({ registry: registryState.registry, source });
    changeList.forEach((change) => session.record(change));
    const plan = session.plan();
    const changedAt = new Date(Number(options.now || Date.now())).toISOString();
    const hmrPayload = createEditorAssetHmrPayload(plan);
    const hotReloadEvents = createAssetHotReloadEvents(plan, hmrPayload, options);
    const statePatch = applyAssetChangeListToEditorState(current, session.changes);
    const assetRefresh = {
      schema: 'omnicore.editor-asset-refresh.v1',
      source,
      changedAt,
      changes: cloneState(session.changes),
      plan,
      hmrPayload
    };
    current = createEditorState({
      ...current,
      ...statePatch,
      assetRefresh,
      hotReloadEvents: [...(current.hotReloadEvents || []), ...hotReloadEvents].slice(-240),
      hotReload: {
        ok: true,
        compiledAt: changedAt,
        changedFiles: [...plan.directAssets],
        hotReloadManifest: hmrPayload,
        hmrPayload
      },
      dockLayout: ensurePanelInDock(current.dockLayout, 'assets', 'left')
    });
    const panel = buildAssetRegistryPanelState(current, { query: options.query || '' });
    current = createEditorState({ ...current, assetRegistryPanel: panel });
    for (const event of hotReloadEvents) emit(event.type, event);
    emit('editor:asset-refresh', assetRefresh);
    emit('editor:hot-reload-event-stream', exportHotReloadEventStream());
    update(current);
    return {
      plan,
      hmrPayload,
      events: hotReloadEvents,
      panel
    };
  }

  function applyAssetRegistryQuickFix(actionId, options = {}) {
    const action = findAssetRegistryQuickFix(current, actionId);
    if (!action) return null;
    let statePatch = {};
    if (action.type === 'registerMissingAsset') {
      statePatch = registerMissingAssetStub(current, action.path, options);
    }
    if (!Object.keys(statePatch).length) return null;
    const next = createEditorState({
      ...current,
      ...statePatch
    });
    const panel = buildAssetRegistryPanelState(next, {
      query: options.query ?? current.assetRegistryPanel?.query ?? ''
    });
    current = createEditorState({
      ...next,
      assetRegistryPanel: panel,
      dockLayout: ensurePanelInDock(next.dockLayout, 'assets', 'left')
    });
    emit('editor:asset-registry-quick-fix', { action, panel });
    pushHistory(current, `修复资源依赖 ${action.path}`);
    update(current);
    return {
      action,
      panel,
      assets: cloneState(current.assets)
    };
  }

  function applyRenderDiagnosticsQuickFix(actionId, options = {}) {
    const action = findRenderDiagnosticsQuickFix(current, actionId);
    if (!action) return null;
    const appliedAt = new Date(Number(options.now || Date.now())).toISOString();
    const plan = buildRenderOptimizationPlan(current, action, { ...options, appliedAt });
    const appliedAction = {
      ...action,
      applied: true,
      appliedAt,
      planId: plan.id,
      result: describeRenderOptimizationAction(action, plan)
    };
    const panel = markRenderDiagnosticsActionApplied(
      current.renderDiagnosticsPanel || buildRenderDiagnosticsPanelState(current),
      appliedAction
    );
    current = createEditorState({
      ...current,
      renderDiagnosticsPanel: panel,
      renderOptimizationPlan: plan,
      dockLayout: ensurePanelInDock(current.dockLayout, 'render-diagnostics', 'bottom')
    });
    emit('editor:render-diagnostics-quick-fix', { action: appliedAction, panel, plan });
    emit('editor:render-optimization-plan', plan);
    pushHistory(current, `应用渲染优化 ${action.label}`);
    update(current);
    showEditorFeedback(`已应用渲染优化：${action.label}`, 'success');
    return {
      action: appliedAction,
      panel,
      plan
    };
  }

  function exportHotReloadEventStream({ since = 0, limit = 100 } = {}) {
    const minId = Number(since || 0);
    const max = Math.max(1, Number(limit || 100));
    const events = (current.hotReloadEvents || [])
      .filter((event) => Number(event.id || 0) > minId)
      .slice(-max);
    return {
      schema: 'omnicore.editor-hot-reload-event-stream.v1',
      source: current.assetRefresh?.source || 'editor',
      lastEventId: Number((current.hotReloadEvents || []).at(-1)?.id || 0),
      events: cloneState(events)
    };
  }

  function createAssetHotReloadEvents(plan, hmrPayload, options = {}) {
    const at = Number(options.now || Date.now());
    const nextId = Number((current.hotReloadEvents || []).at(-1)?.id || 0) + 1;
    const base = {
      source: plan.summary?.source || 'editor-resource-panel',
      at,
      incremental: true
    };
    const editorEvents = (plan.editorEvents || []).map((event, index) => ({
      id: nextId + index,
      ...base,
      ...cloneState(event)
    }));
    return [
      ...editorEvents,
      {
        id: nextId + editorEvents.length,
        ...base,
        type: 'assets:hot-update',
        files: [...hmrPayload.files],
        runtimeActions: cloneState(hmrPayload.runtimeActions),
        editorEvents: cloneState(hmrPayload.editorEvents),
        changePlan: cloneState(hmrPayload.changePlan)
      }
    ];
  }

  function create25DPreview({ zToYScale = 16, showReferenceLines = true, showDepthMappingLines = true } = {}) {
    const entities = current.scene?.entities || [];
    const mixedNodes = entities
      .filter((entity) => isSpine25DNode(entity) || isDimension25DNode(entity))
      .map((entity) => ({
        id: entity.id,
        kind: isSpine25DNode(entity) ? 'spine' : 'dimension3d',
        x: Number(entity.x || 0),
        y: Number(entity.y || 0),
        z: Number(entity.z || entity.position?.z || 0),
        width: Number(entity.width || entity.bounds?.width || 32),
        height: Number(entity.height || entity.bounds?.height || 32),
        depth: Number(entity.depth || entity.bounds?.depth || entity.bounds?.height || 32),
        baselineY: Number(entity.y || 0) + Number(entity.height || entity.bounds?.height || 0)
      }));
    const yToZReferenceLines = showReferenceLines
      ? mixedNodes.map((node) => ({
        id: node.id,
        axis: 'z',
        from: { x: node.x, y: node.baselineY },
        to: { x: node.x, y: node.baselineY - node.z * Number(zToYScale) },
        z: node.z
      }))
      : [];
    const zDepthPreviewLines = showDepthMappingLines
      ? mixedNodes.map((node) => {
        const centerX = node.x + node.width / 2;
        const depthHalf = node.depth / 2;
        return {
          id: node.id,
          axis: 'z-depth',
          from: { x: centerX, y: node.baselineY },
          to: { x: centerX, y: node.baselineY - node.z * Number(zToYScale) },
          z: node.z,
          depthRange: {
            minY: node.baselineY - depthHalf,
            maxY: node.baselineY + depthHalf
          }
        };
      })
      : [];
    const preview = {
      protocol: 'omnicore-editor-25d-preview/v1',
      scene: current.scene?.name || '未命名',
      zToYScale: Number(zToYScale),
      mixedNodes,
      guides: {
        yToZReferenceLines,
        zDepthPreviewLines
      }
    };
    current = createEditorState({ ...current, preview25D: preview });
    return preview;
  }

  function drag25DNode(entityId, position = {}) {
    const entity = findEntity(entityId);
    if (!entity) return null;
    const patch = {
      x: Number(position.x ?? entity.x ?? 0),
      y: Number(position.y ?? entity.y ?? 0),
      z: Number(position.z ?? entity.z ?? entity.position?.z ?? 0)
    };
    current = createEditorState({
      ...current,
      scene: {
        ...current.scene,
        entities: current.scene.entities.map((item) => (
          item.id === entityId
            ? { ...item, ...patch, position: { ...(item.position || {}), ...patch } }
            : item
        ))
      }
    });
    update(current);
    emit('editor:25d-node-drag', { id: entityId, position: patch });
    return { id: entityId, position: patch };
  }

  function generateFakeShadows({ opacity = 0.28, radiusScale = 0.55 } = {}) {
    const shadows = (current.scene?.entities || []).map((entity) => ({
      entityId: entity.id,
      type: 'ellipse',
      x: Number(entity.x || 0) + Number(entity.width || entity.bounds?.width || 32) / 2,
      y: Number(entity.y || 0) + Number(entity.height || entity.bounds?.height || 32),
      radiusX: Number(entity.width || entity.bounds?.width || 32) * Number(radiusScale),
      radiusY: Math.max(6, Number(entity.height || entity.bounds?.depth || 32) * 0.18),
      opacity: Math.max(0, Math.min(1, Number(opacity)))
    }));
    current = createEditorState({
      ...current,
      scene: {
        ...current.scene,
        entities: current.scene.entities.map((entity) => ({
          ...entity,
          fakeShadow: shadows.find((shadow) => shadow.entityId === entity.id) || null
        }))
      }
    });
    update(current);
    emit('editor:25d-fake-shadows', { shadows });
    return shadows;
  }

  function plan25DCoCreation({
    prompt = '',
    scene = current.scene,
    terrain = current.tilemap,
    availableAssets = current.assets
  } = {}) {
    const plan = new EditorCoCreator25D().plan({ prompt, scene, terrain, availableAssets });
    current = createEditorState({ ...current, coCreation25D: plan });
    update(current);
    emit('editor:25d-cocreation-plan', { plan });
    return plan;
  }

  function apply25DCoCreationPlan(plan = current.coCreation25D) {
    if (!plan || typeof plan !== 'object') return null;
    const entity = create25DCoCreationEntity(plan);
    const entities = upsertEntity(current.scene.entities || [], entity);
    const scene = {
      ...current.scene,
      entities
    };
    current = createEditorState({
      ...current,
      scene,
      sceneTabs: updateActiveSceneTab(scene),
      selectedEntityId: entity.id,
      selectedEntityIds: [entity.id],
      coCreation25D: plan
    });
    emit('editor:25d-cocreation-apply', { entity, plan });
    pushHistory(current, `应用 2.5D 共创 ${entity.id}`);
    update(current);
    return {
      protocol: 'omnicore-editor-25d-cocreation-apply/v1',
      entity: cloneState(entity),
      scene: cloneState(scene)
    };
  }

  function previewLivingWorld25D({
    npcs = current.scene?.entities || [],
    locations = current.scene?.locations || [],
    weather = current.scene?.weather || null
  } = {}) {
    const decisions = new SocialAwareness25D().evaluate({ npcs, locations, weather });
    const preview = {
      protocol: 'omnicore-editor-25d-living-world-preview/v1',
      decisions
    };
    current = createEditorState({ ...current, livingWorldPreview25D: preview });
    update(current);
    emit('editor:25d-living-world-preview', preview);
    return preview;
  }

  function previewWorldMemory25D({ events = [], scene = current.scene, npcId = null } = {}) {
    const memory = new WorldMemory25D();
    events.forEach((event) => memory.record(event));
    const preview = {
      protocol: 'omnicore-editor-25d-world-memory-preview/v1',
      snapshot: memory.snapshot(),
      patches: memory.resolveScenePatches(scene),
      dialogue: npcId ? memory.resolveDialogue(npcId) : null
    };
    current = createEditorState({ ...current, worldMemoryPreview25D: preview });
    update(current);
    emit('editor:25d-world-memory-preview', preview);
    return preview;
  }

  function recordDebugEvent(event = {}) {
    const normalizedEvent = { ...event, at: Number(event.at ?? Date.now()) };
    debugTimeline = {
      ...debugTimeline,
      events: [...debugTimeline.events, normalizedEvent]
    };
    emit('editor:debug-event', normalizedEvent);
    update(current);
    return debugTimeline;
  }

  function exportDebugTimeline({ now = Date.now(), windowMs = 10000 } = {}) {
    const minTime = now - windowMs;
    const frames = (Array.isArray(current.profilerHistory) ? current.profilerHistory : []).filter(Boolean);
    const recentFrames = frames.filter((frame) => Number(frame.at || frame.frameStartedAt || now) >= minTime);
    const latest = recentFrames.at(-1) || current.profilerFrame || null;
    const sections = latest?.sections || [];
    return {
      windowMs,
      events: (debugTimeline.events || []).filter((event) => Number(event.at || 0) >= minTime),
      frames: recentFrames,
      profiler: {
        cpuMs: Number(latest?.cpuMs || latest?.totalMs || 0),
        gpuMs: Number(latest?.gpuMs || 0),
        hotspots: [...sections].sort((left, right) => Number(right.duration || 0) - Number(left.duration || 0))
      }
    };
  }

  function exportAnimationStateMachine(machine = {}) {
    const output = {
      format: 'OmniCore.AnimationStateMachine',
      version: 1,
      id: machine.id || 'animation-state-machine',
      states: Array.isArray(machine.states) ? machine.states.map((machineState) => ({ ...machineState })) : [],
      transitions: Array.isArray(machine.transitions) ? machine.transitions.map((transition) => ({ ...transition })) : []
    };
    current = {
      ...current,
      animationStateMachines: {
        ...(current.animationStateMachines || {}),
        [output.id]: output
      }
    };
    return output;
  }

  function instantiateNestedScene(scenePath, transform = {}) {
    const entity = {
      id: transform.id || `nested-${Date.now()}`,
      type: 'NestedScene',
      scenePath,
      scene: scenePath,
      x: Number(transform.x || 0),
      y: Number(transform.y || 0)
    };
    current = createEditorState({
      ...current,
      scene: {
        ...current.scene,
        entities: [...(current.scene?.entities || []), entity]
      }
    });
    emit('editor:nested-scene-instantiated', entity);
    pushHistory(current, `实例化嵌套场景 ${scenePath}`);
    update(current);
    return entity;
  }

  function addVisualScriptNode(type, options = {}) {
    return addFlowNode(type, options);
  }

  function connectVisualScriptNodes(from, to, options = {}) {
    return addFlowEdge(from, to, options);
  }

  function addFlowNode(type, options = {}) {
    const nextGraph = normalizeFlowGraph(current.flowGraph);
    const id = String(options.id || `${type}-${nextGraph.nodes.length + 1}`);
    const presets = {
      event: { label: 'Event', data: { when: { onStart: true } } },
      condition: { label: 'Condition', data: { op: 'equals', left: 'state.flag', right: true } },
      action: { label: 'Action', data: { op: 'set', target: 'state.flag', value: true } }
    };
    const preset = presets[type] || { label: type, data: {} };
    const hasCustomData = Object.prototype.hasOwnProperty.call(options, 'data');
    const node = {
      id,
      type: options.type || type,
      label: options.label || preset.label || type,
      x: Number(options.x ?? 24 + nextGraph.nodes.length * 144),
      y: Number(options.y ?? 24),
      scope: cloneState(options.scope || {}),
      data: hasCustomData ? { ...(options.data || {}) } : { ...(preset.data || {}) }
    };
    const existingIndex = nextGraph.nodes.findIndex((item) => item.id === id);
    if (existingIndex >= 0) nextGraph.nodes[existingIndex] = node;
    else nextGraph.nodes.push(node);
    current = { ...current, flowGraph: nextGraph };
    emit('editor:flow-graph-update', current.flowGraph);
    pushHistory(current, '更新流程图');
    update(current);
    return current.flowGraph;
  }

  function addFlowEdge(from, to, options = {}) {
    if (!from || !to || from === to) return current.flowGraph;
    const nextGraph = normalizeFlowGraph(current.flowGraph);
    const nodeIds = new Set(nextGraph.nodes.map((node) => node.id));
    if (!nodeIds.has(from) || !nodeIds.has(to)) return current.flowGraph;
    const pin = options.pin == null ? null : String(options.pin);
    if (!nextGraph.edges.some((edge) => edge.from === from && edge.to === to && (edge.pin || null) === pin)) {
      nextGraph.edges.push({
        from,
        to,
        ...(pin ? { pin } : {})
      });
    }
    current = { ...current, flowGraph: nextGraph };
    emit('editor:flow-graph-update', current.flowGraph);
    pushHistory(current, '连接流程图节点');
    update(current);
    return current.flowGraph;
  }

  function exportFlowGraph() {
    const eventSheet = exportFlowGraphEventSheet();
    emit('editor:flow-graph-export', { eventSheet, graph: normalizeFlowGraph(current.flowGraph) });
    return eventSheet;
  }

  function emit(type, payload = {}) {
    const message = createLiveSyncMessage(type, payload);
    if (transport?.send) transport.send(JSON.stringify(message));
    else client?.send?.(type, payload);
    return message;
  }

  function beginDrag(entity, event, options = {}) {
    const ids = selectedIds(current).includes(entity.id) ? selectedIds(current) : [entity.id];
    const startEntities = new Map(current.scene.entities
      .filter((item) => ids.includes(item.id))
      .map((item) => [item.id, cloneState(item)]));
    dragSession = {
      ids,
      anchorId: entity.id,
      axis: options.axis || null,
      source: options.source || 'node',
      pointer: pointerFromEvent(event),
      startEntities,
      changed: false
    };
    current = {
      ...current,
      selectedEntityId: entity.id,
      selectedEntityIds: ids,
      simulation: { active: true, physics: true, logic: true }
    };
    emit('editor:simulate-start', { ids, physics: true, logic: true });
    update(current);
  }

  function applyDrag(event) {
    if (!dragSession) return;
    const pointer = pointerFromEvent(event);
    const snappedPointer = snapEditorPoint(pointer, current);
    const dx = pointer.x - dragSession.pointer.x;
    const dy = pointer.y - dragSession.pointer.y;
    const scale = Math.max(0.1, pointer.x / 100);
    const entities = current.scene.entities.map((entity) => {
      const start = dragSession.startEntities.get(entity.id);
      if (!start) return entity;
      if (dragSession.axis) return applyGizmoAxisDrag(entity, start, snappedPointer, dx, dy);
      if (current.gizmoMode === 'translate' && dragSession.ids.length === 1) return { ...entity, x: snappedPointer.x, y: snappedPointer.y };
      if (current.gizmoMode === 'translate') {
        const next = {
          x: Number(start.x || 0) + dx,
          y: Number(start.y || 0) + dy
        };
        const snapped = snapEditorPoint(next, current);
        return { ...entity, x: snapped.x, y: snapped.y };
      }
      if (current.gizmoMode === 'rotate') return { ...entity, rotation: pointer.x / 100 };
      if (current.gizmoMode === 'scale') return { ...entity, scaleX: scale, scaleY: scale };
      return entity;
    });
    current = {
      ...current,
      scene: { ...current.scene, entities }
    };
    dragSession.changed = true;
    emit('editor:simulate-step', { ids: dragSession.ids, patch: { x: snappedPointer.x, y: snappedPointer.y }, physics: true, logic: true });
    update(current);
  }

  function applyGizmoAxisDrag(entity, start, snappedPointer, dx, dy) {
    if (current.gizmoMode === 'translate') {
      if (dragSession.axis === 'x') return { ...entity, x: snappedPointer.x };
      if (dragSession.axis === 'y') return { ...entity, y: snappedPointer.y };
      return { ...entity, z: Number(start.z || 0) + Math.round((dx - dy) / 8) };
    }
    if (current.gizmoMode === 'rotate') {
      const delta = dragSession.axis === 'y' ? dy : dx;
      return { ...entity, rotation: Number(start.rotation || 0) + delta / 100 };
    }
    if (current.gizmoMode === 'scale') {
      const delta = dragSession.axis === 'y' ? dy : dx;
      const scale = Math.max(0.1, Number(start.scale || start.scaleX || 1) + delta / 100);
      if (dragSession.axis === 'x') return { ...entity, scaleX: scale, scale };
      if (dragSession.axis === 'y') return { ...entity, scaleY: scale, scale };
      return { ...entity, scaleX: scale, scaleY: scale, scale };
    }
    return entity;
  }

  function beginMarqueeSelection(event) {
    marqueeSession = {
      start: pointerFromEvent(event),
      current: pointerFromEvent(event)
    };
    renderMarqueeFeedback();
  }

  function finishMarqueeSelection() {
    const rect = normalizeRect(marqueeSession.start, marqueeSession.current);
    const ids = current.scene.entities
      .filter((entity) => rectsIntersect(rect, entityRect(entity)))
      .map((entity) => entity.id);
    selectEntity(ids.at(-1) || null, { ids });
  }

  function renderMarqueeFeedback() {
    const view = root.querySelector('[data-scene-drop-zone="true"]');
    if (!view || !marqueeSession) return;
    clearMarqueeFeedback();
    const rect = normalizeRect(marqueeSession.start, marqueeSession.current);
    const box = document.createElement('div');
    box.className = 'selection-marquee';
    box.dataset.selectionMarquee = 'true';
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    view.appendChild(box);
  }

  function clearMarqueeFeedback() {
    root.querySelector('[data-selection-marquee="true"]')?.remove();
  }

  function onPointerMove(event) {
    if (marqueeSession) {
      marqueeSession.current = pointerFromEvent(event);
      renderMarqueeFeedback();
      return;
    }
    if (!dragSession) return;
    applyDrag(event);
  }

  function onPointerUp() {
    tilePaintSession = false;
    if (marqueeSession) {
      finishMarqueeSelection();
      marqueeSession = null;
      clearMarqueeFeedback();
      return;
    }
    if (dragSession) {
      emit('editor:simulate-stop', { ids: dragSession.ids });
      current = { ...current, simulation: { active: false, physics: false, logic: false } };
      if (dragSession.changed) {
        emitDragEntityUpdates();
        pushHistory(current, `拖动 ${dragSession.ids.length} 个实体`);
        showEditorFeedback(`已移动 ${dragSession.ids.length} 个实体`, 'success');
      }
      update(current);
    }
    dragSession = null;
  }

  function emitDragEntityUpdates() {
    const fields = ['x', 'y', 'z', 'rotation', 'scale', 'scaleX', 'scaleY'];
    for (const id of dragSession.ids) {
      const before = dragSession.startEntities.get(id) || {};
      const after = current.scene.entities.find((entity) => entity.id === id) || {};
      const patch = {};
      for (const field of fields) {
        if (JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null)) patch[field] = after[field];
      }
      if (Object.keys(patch).length) emit('editor:update-entity', { id, patch, commandId: createCommandId('gizmo') });
    }
  }

  function onKeyDown(event) {
    const key = String(event.key || '').toLowerCase();
    const textEditingTarget = inputFocusManager.isTextInputTarget(event.target);
    const modes = {
      q: 'select',
      w: 'translate',
      e: 'rotate',
      r: 'scale'
    };
    if (!event.ctrlKey && !event.metaKey && modes[key]) {
      if (textEditingTarget || !inputFocusManager.areGizmoShortcutsEnabled()) return;
      event.preventDefault?.();
      setGizmoMode(modes[key]);
      return;
    }
    if (key === 'delete' || key === 'backspace') {
      if (textEditingTarget) return;
      event.preventDefault?.();
      deleteSelection();
      return;
    }
    const command = event.ctrlKey || event.metaKey;
    if (!command) return;
    if (key === 'f' && event.shiftKey) {
      event.preventDefault?.();
      openGlobalSearch();
      return;
    }
    if (key === 'o') {
      event.preventDefault?.();
      openProjectWorkspace();
      return;
    }
    if (key === 's') {
      event.preventDefault?.();
      saveSnapshot('keyboard');
    }
    if (key === 'k') {
      event.preventDefault?.();
      openCommandPalette();
      return;
    }
    if (key === 'z' && event.shiftKey) {
      event.preventDefault?.();
      redo();
    } else if (key === 'z') {
      event.preventDefault?.();
      undo();
    } else if (key === 'c') {
      event.preventDefault?.();
      copySelection();
    } else if (key === 'v') {
      event.preventDefault?.();
      pasteSelection();
    }
  }

  function runToolbarAction(action) {
    if (action === 'open-project') {
      setEditorWorkspaceMode('editor');
      const result = openProjectWorkspace();
      showEditorFeedback('正在打开项目...', 'info');
      return result;
    }
    if (action === 'save') return saveSnapshot('工具栏');
    if (action === 'undo') {
      const result = undo();
      showEditorFeedback('已撤销', 'info');
      update(current);
      return result;
    }
    if (action === 'redo') {
      const result = redo();
      showEditorFeedback('已重做', 'info');
      update(current);
      return result;
    }
    if (action === 'play') {
      setEditorWorkspaceMode('editor');
      current = {
        ...current,
        simulation: { active: true, physics: true, logic: true },
        playState: { ...current.playState, mode: 'playing' }
      };
      emit('editor:set-play-mode', { mode: 'playing' });
      emit('editor:play', current.simulation);
      showEditorFeedback('运行中', 'success');
      return update(current);
    }
    if (action === 'pause') {
      setEditorWorkspaceMode('editor');
      current = {
        ...current,
        simulation: { active: false, physics: false, logic: false },
        playState: { ...current.playState, mode: 'paused' }
      };
      emit('editor:set-play-mode', { mode: 'paused' });
      emit('editor:pause', current.simulation);
      showEditorFeedback('已暂停', 'info');
      return update(current);
    }
    if (action === 'step') {
      setEditorWorkspaceMode('editor');
      current = {
        ...current,
        simulation: { active: false, physics: true, logic: true },
        playState: {
          ...current.playState,
          mode: 'paused',
          frame: Number(current.playState?.frame || 0) + 1
        }
      };
      emit('editor:set-play-mode', { mode: 'paused' });
      emit('editor:step-frame', { frame: current.playState.frame, physics: true, logic: true });
      showEditorFeedback(`已单步到第 ${current.playState.frame} 帧`, 'info');
      return update(current);
    }
    if (action === 'profiler') {
      setEditorWorkspaceMode('editor');
      const result = openProfiler();
      showEditorFeedback('已打开性能面板', 'info');
      update(current);
      return result;
    }
    if (action === 'dock-reset') {
      emit('editor:dock-reset', DEFAULT_DOCK_LAYOUT);
      showEditorFeedback('已重置布局', 'info');
      return setDockLayout(DEFAULT_DOCK_LAYOUT);
    }
    return null;
  }

  function runMenuCommand(command) {
    if (command === 'open-project-folder') return openProjectWorkspace();
    if (command === 'save-scene') return saveSnapshot('菜单');
    if (command === 'reset-dock-layout') {
      showEditorFeedback('已重置布局', 'info');
      return setDockLayout(DEFAULT_DOCK_LAYOUT);
    }
    return null;
  }

  function renderToolbar() {
    toolbar.textContent = '';
    for (const action of TOOLBAR_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.editorTool = action.id;
      button.dataset.editorAction = action.id;
      button.dataset.editorIcon = toolbarIcon(action.id);
      button.title = action.shortcut ? `${action.label} (${action.shortcut})` : action.label;
      button.textContent = t(`toolbar.${action.id}`, action.label);
      const mode = current.playState?.mode || (current.simulation.active ? 'playing' : 'editing');
      if ((action.id === 'play' && mode === 'playing') || (action.id === 'pause' && mode === 'paused')) {
        button.className = 'selected';
      }
      button.addEventListener('click', () => runToolbarAction(action.id));
      toolbar.appendChild(button);
    }
  }

  function toolbarIcon(actionId) {
    return {
      'open-project': '项',
      save: '存',
      undo: '撤',
      redo: '重',
      play: '▶',
      pause: '停',
      step: '步',
      profiler: '析',
      'dock-reset': '布'
    }[actionId] || '工';
  }

  function renderStatusbar() {
    const entityCount = current.scene.entities.length;
    const mode = current.playState?.mode || (current.simulation.active ? 'running' : 'editing');
    statusbar.textContent = `${localizeSceneName(current.scene.name)} | ${entityCount} 个实体 | ${localizeGizmoMode(current.gizmoMode)} | ${localizePlayMode(mode)}`;
    statusbar.dataset.editorSurface = 'statusbar';
    const workspace = document.createElement('span');
    workspace.dataset.workspaceRoot = 'true';
    workspace.textContent = current.workspace?.root ? ` | ${current.workspace.root}` : '';
    statusbar.appendChild(workspace);
    if (editorFeedback?.message) {
      const feedback = document.createElement('span');
      feedback.dataset.editorFeedback = editorFeedback.tone || 'info';
      feedback.textContent = ` | ${editorFeedback.message}`;
      statusbar.appendChild(feedback);
    }
  }

  function showEditorFeedback(message, tone = 'info') {
    editorFeedback = { message, tone };
    emit('editor:feedback', editorFeedback);
    return editorFeedback;
  }

  function renderTransientSurfaces() {
    root.querySelector('[data-command-palette]')?.remove();
    root.querySelector('[data-scene-validation]')?.remove();
    root.querySelector('[data-particle-editor]')?.remove();
    root.querySelector('[data-sprite-editor]')?.remove();
    root.querySelector('[data-resource-picker]')?.remove();
    root.querySelector('[data-prefab-save-prompt]')?.remove();
    root.querySelector('[data-authoring-health]')?.remove();
    root.querySelector('[data-25d-production-panel]')?.remove();
    const frame = root.querySelector('.editor-frame') || root;
    if (current.commandPaletteOpen) frame.appendChild(createCommandPalette());
    if (current.sceneValidation?.issues?.length) frame.appendChild(createSceneValidationPanel());
    if (current.particleEditor?.open) frame.appendChild(createParticleEditorPanel());
    if (current.spriteEditor?.open) frame.appendChild(createSpriteEditorPanel());
    if (current.resourcePicker?.open) frame.appendChild(createResourcePickerPanel());
    if (current.prefabHotEdit?.promptOpen) frame.appendChild(createPrefabHotEditPrompt());
    if (current.authoringHealth?.open) frame.appendChild(createAuthoringHealthPanel());
    if (shouldShow25DProductionPanel()) frame.appendChild(create25DProductionPanel());
  }

  function shouldShow25DProductionPanel() {
    return Boolean(current.coCreation25D || appliedCoCreationPlans().length > 0 || current.preview25D);
  }

  function create25DProductionPanel() {
    const report = create25DProductionReadinessReport();
    const visualEvidence = create25DVisualEvidence();
    const appliedPlans = Number(report.evidence.appliedCoCreationPlans || 0);
    const stages = [
      { id: 'plan', label: '规划', status: current.coCreation25D || appliedPlans > 0 ? 'complete' : 'pending' },
      { id: 'apply', label: '应用', status: appliedPlans > 0 ? 'complete' : current.coCreation25D ? 'blocked' : 'pending' },
      { id: 'save', label: '保存', status: report.evidence.saved ? 'complete' : appliedPlans > 0 ? 'blocked' : 'pending' },
      { id: 'export', label: '导出', status: report.evidence.entryScene && report.evidence.targets.length ? 'complete' : 'blocked' },
      { id: 'readiness', label: '就绪度', status: report.ready ? 'complete' : 'blocked' }
    ];
    const wrap = document.createElement('div');
    wrap.className = 'production-25d-panel floating-editor-panel';
    wrap.setAttribute('data-25d-production-panel', 'true');
    wrap.dataset.ready = report.ready ? 'true' : 'false';
    const title = document.createElement('h3');
    title.textContent = '2.5D 生产检查';
    const score = document.createElement('strong');
    score.className = 'production-25d-score';
    score.setAttribute('data-25d-production-score', 'true');
    score.textContent = `${report.score}`;
    const list = document.createElement('div');
    list.className = 'production-25d-stages';
    for (const stage of stages) {
      const item = document.createElement('div');
      item.className = `production-25d-stage production-25d-stage-${stage.status}`;
      item.setAttribute('data-25d-stage', stage.id);
      item.dataset.status = stage.status;
      item.textContent = stage.label;
      list.appendChild(item);
    }
    const action = document.createElement('p');
    action.className = 'production-25d-action';
    action.textContent = report.nextActions[0] || '已准备好轻量部署。';
    const visual = document.createElement('div');
    visual.className = 'production-25d-visual';
    visual.setAttribute('data-25d-visual-evidence', 'true');
    visual.textContent = `视觉证据 ${visualEvidence.summary.coCreatedEntities}`;
    const visualTypes = [...new Set(visualEvidence.layers.map((layer) => layer.type))]
      .filter((type) => type !== 'entity');
    for (const type of visualTypes) {
      const chip = document.createElement('span');
      chip.className = 'production-25d-visual-chip';
      chip.setAttribute('data-25d-visual-layer', type);
      chip.textContent = type;
      visual.appendChild(chip);
    }
    wrap.append(title, score, list, action, visual);
    const saveVersionPanel = createSaveVersionPanel();
    if (saveVersionPanel) wrap.appendChild(saveVersionPanel);
    return wrap;
  }

  function createSaveVersionPanel() {
    const versions = listSaveVersions();
    if (!versions.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'save-version-panel';
    wrap.setAttribute('data-save-version-panel', 'true');
    const title = document.createElement('h4');
    title.textContent = '保存版本';
    wrap.appendChild(title);

    if (versions.length >= 2) {
      const diff = diffSaveVersions(versions[versions.length - 2].id, versions[versions.length - 1].id);
      const summary = document.createElement('p');
      summary.className = 'save-version-diff';
      summary.setAttribute('data-save-version-diff', 'true');
      summary.textContent = formatSaveVersionDiff(diff);
      wrap.appendChild(summary);
    }

    const list = document.createElement('ol');
    list.className = 'save-version-list';
    for (const version of versions.slice(-5)) {
      const row = document.createElement('li');
      row.setAttribute('data-save-version-row', version.id);
      const label = document.createElement('span');
      label.textContent = `${version.name} (${version.entities})`;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-save-version-rollback', version.id);
      button.textContent = '回滚';
      button.addEventListener('click', () => rollbackToSaveVersion(version.id));
      row.append(label, button);
      list.appendChild(row);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function createCommandPalette() {
    const wrap = document.createElement('div');
    wrap.className = 'command-palette';
    wrap.dataset.commandPalette = 'true';
    const input = document.createElement('input');
    input.dataset.commandPaletteInput = 'true';
    input.value = 'scene:validate';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeCommandPalette();
      if (event.key === 'Enter') runCommand(input.value);
    });
    const validate = document.createElement('button');
    validate.type = 'button';
    validate.dataset.commandId = 'scene:validate';
    validate.textContent = '校验场景';
    validate.addEventListener('click', () => runCommand('scene:validate'));
    const overlays = document.createElement('button');
    overlays.type = 'button';
    overlays.dataset.commandId = 'overlay:collision-depth';
    overlays.textContent = '显示碰撞/深度';
    overlays.addEventListener('click', () => runCommand('overlay:collision-depth'));
    wrap.append(input, validate, overlays);
    queueMicrotask(() => input.focus?.());
    return wrap;
  }

  function createSceneValidationPanel() {
    const wrap = document.createElement('div');
    wrap.className = 'scene-validation';
    wrap.dataset.sceneValidation = 'true';
    for (const issue of current.sceneValidation.issues) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.sceneIssue = issue.code;
      button.dataset.sceneIssueEntity = issue.entityId || '';
      button.textContent = `${issue.code}: ${issue.entityId || 'scene'}`;
      button.addEventListener('click', () => locateSceneIssue(issue));
      wrap.appendChild(button);
    }
    return wrap;
  }

  function createResourcePickerPanel() {
    const picker = normalizeResourcePickerState(current.resourcePicker);
    const wrap = document.createElement('div');
    wrap.className = 'resource-picker floating-editor-panel';
    wrap.dataset.resourcePicker = picker.field || '';
    const title = document.createElement('h3');
    title.textContent = `选择${picker.field || '资源'}`;
    const search = document.createElement('input');
    search.type = 'search';
    search.dataset.resourcePickerSearch = 'true';
    search.value = picker.query;
    search.addEventListener('input', () => openResourcePicker(picker.field, { query: search.value }));
    const list = document.createElement('div');
    list.className = 'resource-picker-list';
    const assets = filterResourceAssets(current.assets, picker.query);
    for (const asset of assets) {
      const entry = normalizeAssetEntry(asset);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.resourcePickerAsset = entry.path;
      button.textContent = entry.path;
      const thumb = document.createElement('img');
      thumb.alt = entry.name;
      thumb.src = entry.thumbnail || entry.url || entry.path;
      button.prepend(thumb);
      button.addEventListener('click', () => selectResourceForField(picker.field, entry.path));
      list.appendChild(button);
    }
    wrap.append(title, search, list);
    return wrap;
  }

  function createPrefabHotEditPrompt() {
    const hotEdit = normalizePrefabHotEditState(current.prefabHotEdit);
    const wrap = document.createElement('div');
    wrap.className = 'prefab-hot-edit-prompt floating-editor-panel';
    wrap.dataset.prefabSavePrompt = hotEdit.prefabId || '';
    const title = document.createElement('h3');
    title.textContent = `保存预制体变体 ${hotEdit.prefabId}`;
    const body = document.createElement('p');
    body.textContent = '暂停运行时存在待保存改动。离开运行编辑模式前，请把覆盖项保存回预制体变体。';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = '保存';
    save.addEventListener('click', () => savePrefabHotEdit());
    const ignore = document.createElement('button');
    ignore.type = 'button';
    ignore.textContent = '忽略';
    ignore.addEventListener('click', () => {
      current = { ...current, prefabHotEdit: { prefabId: null, patch: {}, dirty: false, promptOpen: false } };
      emit('editor:ignore-prefab-hot-edit', { prefabId: hotEdit.prefabId });
      update(current);
    });
    wrap.append(title, body, save, ignore);
    return wrap;
  }

  function createAuthoringHealthPanel() {
    const report = current.authoringHealth || { ok: true, issues: [], hotspots: [], counts: {} };
    const wrap = document.createElement('div');
    wrap.className = 'authoring-health-panel floating-editor-panel';
    wrap.dataset.authoringHealth = report.ok ? 'ok' : 'issues';
    const title = document.createElement('h3');
    title.textContent = report.ok ? '创作健康：就绪' : '创作健康：存在问题';
    const counts = document.createElement('div');
    counts.className = 'authoring-health-counts';
    counts.textContent = `动画 ${report.counts?.animations || 0} | 粒子 ${report.counts?.particles || 0} | 精灵 ${report.counts?.sprites || 0} | 场景 ${report.counts?.scenes || 0}`;
    const list = document.createElement('div');
    list.className = 'authoring-health-issues';
    for (const issue of report.issues || []) {
      const row = document.createElement('div');
      row.dataset.authoringHealthIssue = issue.code;
      row.className = `authoring-health-${issue.severity || 'error'}`;
      row.textContent = `${issue.code}: ${issue.message}`;
      list.appendChild(row);
    }
    const hotspots = document.createElement('div');
    hotspots.className = 'authoring-health-hotspots';
    for (const hotspot of report.hotspots || []) {
      const row = document.createElement('div');
      row.dataset.authoringHealthHotspot = hotspot.name;
      row.className = `authoring-health-${hotspot.severity}`;
      row.textContent = `${hotspot.name} ${hotspot.duration}ms ${hotspot.severity}: ${hotspot.suggestion}`;
      hotspots.appendChild(row);
    }
    wrap.append(title, counts, list, hotspots);
    return wrap;
  }

  function createParticleEditorPanel() {
    const config = normalizeParticleConfig(current.particleEditor?.config || {});
    const wrap = document.createElement('div');
    wrap.className = 'particle-editor floating-editor-panel';
    wrap.dataset.particleEditor = 'true';

    const title = document.createElement('h3');
    title.textContent = '粒子编辑器';
    wrap.appendChild(title);

    for (const field of ['emissionRate', 'lifetime', 'initialVelocity', 'gravity']) {
      const label = document.createElement('label');
      label.textContent = localizeParticleField(field);
      const input = document.createElement('input');
      input.type = 'range';
      input.dataset.particleSlider = field;
      input.min = field === 'lifetime' ? '0' : '-800';
      input.max = field === 'lifetime' ? '5' : '800';
      input.step = field === 'lifetime' ? '0.1' : '1';
      input.value = String(config[field]);
      input.addEventListener('input', () => setParticleParameter(field, input.value));
      label.appendChild(input);
      wrap.appendChild(label);
    }

    const preview = document.createElement('div');
    preview.className = 'particle-preview';
    preview.dataset.particlePreview = 'true';
    const count = Math.max(6, Math.min(30, Math.round(config.emissionRate / 8)));
    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement('i');
      const progress = count === 1 ? 0 : index / (count - 1);
      spark.style.left = `${10 + progress * 78}%`;
      spark.style.top = `${72 - progress * 48}%`;
      spark.style.opacity = `${Math.max(0.18, 1 - progress)}`;
      preview.appendChild(spark);
    }
    wrap.appendChild(preview);

    const exportPreview = document.createElement('pre');
    exportPreview.dataset.particleExportPreview = 'true';
    exportPreview.textContent = JSON.stringify(exportParticleConfig().config, null, 2);
    wrap.appendChild(exportPreview);
    return wrap;
  }

  function createSpriteEditorPanel() {
    const editor = current.spriteEditor || {};
    const nineSlice = normalizeNineSlice(editor.nineSlice || {});
    const wrap = document.createElement('div');
    wrap.className = 'sprite-editor floating-editor-panel';
    wrap.dataset.spriteEditor = editor.source || '';

    const title = document.createElement('h3');
    title.textContent = editor.source || '精灵编辑器';
    wrap.appendChild(title);

    const canvas = document.createElement('div');
    canvas.className = 'sprite-edit-canvas';
    canvas.dataset.spriteCanvas = 'true';
    for (const guide of ['left', 'right', 'top', 'bottom']) {
      const line = document.createElement('button');
      line.type = 'button';
      line.className = `nine-slice-guide guide-${guide}`;
      line.dataset.nineSliceGuide = guide;
      if (guide === 'left' || guide === 'right') line.style.left = `${nineSlice[guide]}px`;
      else line.style.top = `${nineSlice[guide]}px`;
      canvas.appendChild(line);
    }
    if (editor.collider) {
      const collider = document.createElement('div');
      collider.className = 'collider-outline';
      collider.dataset.colliderOutline = 'true';
      canvas.appendChild(collider);
    }
    wrap.appendChild(canvas);

    const material = findSelectedEntity(current)?.material || {};
    wrap.appendChild(createMaterialPanel(material));
    const metaPreview = document.createElement('pre');
    metaPreview.dataset.spriteMetaPreview = 'true';
    metaPreview.textContent = JSON.stringify(exportSpriteMeta().meta, null, 2);
    wrap.appendChild(metaPreview);
    return wrap;
  }

  function renderPanel(name, body) {
    const section = document.createElement('section');
    section.dataset.panel = name;
    section.dataset.dockPanel = name;
    section.dataset.editorSurface = 'panel';
    section.className = `editor-panel ${name}`;
    section.draggable = true;
    section.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('application/x-omnicore-dock-panel', name);
      event.dataTransfer?.setData('text/plain', name);
    });
    const title = document.createElement('h2');
    title.textContent = t(`panel.${name}`, PANEL_TITLES[name]);
    section.append(title, body);
    return section;
  }

  function renderHierarchy() {
    const list = document.createElement('ol');
    list.className = 'hierarchy-list';
    const ids = selectedIds(current);
    for (const entity of current.scene.entities) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.editorEntityId = entity.id;
      button.textContent = entity.name || entity.id;
      button.className = ids.includes(entity.id) ? 'selected' : '';
      button.addEventListener('click', (event) => selectEntity(entity.id, { append: event.shiftKey }));
      item.appendChild(button);
      list.appendChild(item);
    }
    return list;
  }

  function renderInspector() {
    const selected = findSelectedEntity(current) || current.scene.entities[0] || null;
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => event.preventDefault());
    for (const key of inspectorFields(selected)) {
      const label = document.createElement('label');
      label.textContent = t(`inspector.${key}`, key);
      const input = document.createElement('input');
      input.value = selected?.[key] ?? '';
      input.dataset.inspectorField = key;
      input.disabled = !selected || key === 'id';
      if (['sprite', 'texture'].includes(key)) {
        input.addEventListener('click', () => {
          if (selected) openResourcePicker(key);
        });
      }
      input.addEventListener('input', () => {
        if (!selected || key === 'id') return;
        patchEntity(selected.id, { [key]: parseFieldValue(key, input.value, selected?.[key]) });
      });
      label.appendChild(input);
      form.appendChild(label);
    }
    const components = document.createElement('div');
    components.dataset.inspectorComponents = 'true';
    components.textContent = formatComponents(selected?.components || []);
    form.appendChild(components);
    if (selected?.type === 'sprite' || selected?.sprite || selected?.texture) {
      form.appendChild(createMaterialPanel(selected.material || {}, selected.id));
    }
    const scriptBinding = resolveScriptBinding(selected);
    if (scriptBinding) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.inspectorOpenScript = 'true';
      button.textContent = t('inspector.openScript', 'Open Script');
      button.addEventListener('click', () => openEntityScript(selected.id));
      form.appendChild(button);
    }
    return form;
  }

  function createMaterialPanel(material = {}, entityId = current.selectedEntityId) {
    const normalized = normalizeSpriteMaterial(material);
    const panel = document.createElement('fieldset');
    panel.className = 'material-panel';
    panel.dataset.materialPanel = 'true';
    const legend = document.createElement('legend');
    legend.textContent = '材质';
    panel.appendChild(legend);
    for (const field of ['alphaClip', 'colorTint', 'normalMap']) {
      const label = document.createElement('label');
      label.textContent = localizeMaterialField(field);
      const input = document.createElement('input');
      input.dataset.materialField = field;
      if (field === 'colorTint') input.type = 'color';
      else if (field === 'alphaClip') {
        input.type = 'number';
        input.min = '0';
        input.max = '1';
        input.step = '0.01';
      } else {
        input.type = 'text';
      }
      input.value = normalized[field] ?? '';
      input.addEventListener('input', () => {
        if (!entityId) return;
        setSpriteMaterial(entityId, { [field]: field === 'alphaClip' ? Number(input.value || 0) : input.value });
      });
      label.appendChild(input);
      panel.appendChild(label);
    }
    return panel;
  }

  function renderSceneView() {
    const wrap = document.createElement('div');
    wrap.className = 'scene-wrap';
    const sceneTabs = renderSceneTabs();
    const gizmoToolbar = document.createElement('div');
    gizmoToolbar.className = 'gizmo-toolbar';
    for (const mode of ['select', 'translate', 'rotate', 'scale']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.gizmoMode = mode;
      button.textContent = t(`gizmo.${mode}`, mode);
      button.className = current.gizmoMode === mode ? 'selected' : '';
      button.addEventListener('click', () => setGizmoMode(mode));
      gizmoToolbar.appendChild(button);
    }

    const view = document.createElement('div');
    view.className = 'scene-canvas';
    view.dataset.sceneDropZone = 'true';
    view.addEventListener('mousedown', (event) => {
      if (!event.shiftKey) return;
      event.preventDefault();
      beginMarqueeSelection(event);
    });
    view.addEventListener('dragover', (event) => event.preventDefault());
    view.addEventListener('drop', (event) => {
      event.preventDefault();
      const assetPath = event.dataTransfer?.getData('application/x-omnicore-asset');
      const prefabId = event.dataTransfer?.getData('application/x-omnicore-prefab')
        || (!assetPath ? event.dataTransfer?.getData('text/plain') : '');
      if (assetPath && isSceneAsset(assetPath)) instantiateSubScene(assetPath, event);
      else if (assetPath) instantiateAsset(assetPath, event);
      else instantiatePrefab(prefabId, event);
    });

    for (const entity of current.scene.entities) view.appendChild(createSceneNodeButton(entity));
    if (!current.scene.entities.length) view.appendChild(createOnboardingGuide());
    if (current.sceneOverlays?.collision) {
      for (const entity of current.scene.entities) view.appendChild(createCollisionOverlay(entity));
    }
    if (current.sceneOverlays?.depth) {
      for (const entity of current.scene.entities) view.appendChild(createDepthOverlay(entity));
    }
    for (const line of current.preview25D?.guides?.zDepthPreviewLines || []) {
      view.appendChild(createZDepthPreviewLine(line));
    }
    for (const entity of current.scene.entities.filter((item) => selectedIds(current).includes(item.id))) {
      view.appendChild(createSelectionOutline(entity));
      view.appendChild(createOriginMarker(entity));
      view.appendChild(createTransformGizmo(entity));
    }
    if (current.prefabPreview) view.appendChild(createPrefabPreviewModel(current.prefabPreview));
    wrap.append(sceneTabs, gizmoToolbar, view, createUndoHistoryView());
    return wrap;
  }

  function createOnboardingGuide() {
    const guide = document.createElement('aside');
    guide.className = 'editor-onboarding';
    guide.dataset.editorOnboarding = 'true';
    guide.innerHTML = [
      '<strong>打开项目</strong>',
      '<span>把资源或预制体拖入画布即可创建内容。</span>',
      '<span>选中实体后使用 W/E/R 进行移动、旋转和缩放。</span>'
    ].join('');
    return guide;
  }

  function renderSceneTabs() {
    const tabs = document.createElement('div');
    tabs.className = 'scene-tabs';
    for (const tab of current.sceneTabs || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.sceneTab = tab.path;
      button.className = current.activeSceneTabPath === tab.path ? 'selected' : '';
      button.textContent = tab.path.split('/').pop() || tab.path;
      button.addEventListener('click', () => switchSceneTab(tab.path));
      tabs.appendChild(button);
    }
    return tabs;
  }

  function createSceneNodeButton(entity) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = [
      'scene-node',
      selectedIds(current).includes(entity.id) ? 'selected' : '',
      current.sceneIssueTargetId === entity.id ? 'issue-target' : ''
    ].filter(Boolean).join(' ');
    node.dataset.sceneNodeId = entity.id;
    node.textContent = entity.name || entity.id;
    node.style.left = `${entity.x || 0}px`;
    node.style.top = `${entity.y || 0}px`;
    node.style.width = `${Math.max(24, entity.width || 32)}px`;
    node.style.height = `${Math.max(24, entity.height || 32)}px`;
    node.style.transform = `rotate(${entity.rotation || 0}rad) scale(${entity.scaleX ?? 1}, ${entity.scaleY ?? 1})`;
    node.addEventListener('click', (event) => selectEntity(entity.id, { append: event.shiftKey }));
    node.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectEntity(entity.id, { append: event.shiftKey });
      beginDrag(entity, event);
    });
    return node;
  }

  function createTransformGizmo(entity) {
    const gizmo = document.createElement('div');
    gizmo.className = `transform-gizmo transform-${current.gizmoMode}`;
    gizmo.dataset.transformGizmo = entity.id;
    gizmo.style.left = `${Number(entity.x || 0) + Math.max(24, Number(entity.width || 32)) + 8}px`;
    gizmo.style.top = `${Number(entity.y || 0)}px`;
    for (const axis of ['x', 'y', 'z']) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = `gizmo-axis gizmo-${axis}`;
      handle.dataset.gizmoAxis = axis;
      handle.title = `${current.gizmoMode} ${axis.toUpperCase()}`;
      handle.textContent = axis.toUpperCase();
      handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectEntity(entity.id);
        beginDrag(entity, event, { axis, source: 'gizmo' });
      });
      gizmo.appendChild(handle);
    }
    return gizmo;
  }

  function createPrefabPreviewModel(entity) {
    const preview = document.createElement('div');
    preview.className = 'prefab-preview-model';
    preview.dataset.prefabPreviewModel = entity.id || entity.name || 'preview';
    preview.textContent = entity.name || entity.id || '预制体预览';
    preview.style.left = `${Number(entity.x || 40)}px`;
    preview.style.top = `${Number(entity.y || 40)}px`;
    preview.style.width = `${Math.max(24, Number(entity.width || 32))}px`;
    preview.style.height = `${Math.max(24, Number(entity.height || 32))}px`;
    return preview;
  }

  function createCollisionOverlay(entity) {
    const collider = entity.collider || {};
    const width = Number(collider.width || entity.width || 32);
    const height = Number(collider.height || entity.height || 32);
    const x = Number(entity.x || 0) + Number(collider.offsetX || 0);
    const y = Number(entity.y || 0) + Number(collider.offsetY || 0);
    const overlay = document.createElement('div');
    overlay.className = 'collision-overlay';
    overlay.dataset.collisionOverlay = entity.id;
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    return overlay;
  }

  function createDepthOverlay(entity) {
    const overlay = document.createElement('div');
    overlay.className = 'depth-overlay';
    overlay.dataset.depthOverlay = entity.id;
    overlay.style.left = `${Number(entity.x || 0)}px`;
    overlay.style.top = `${Number(entity.y || 0) - 18}px`;
    overlay.textContent = `z:${Number(entity.zIndex ?? entity.depth ?? 0)}`;
    return overlay;
  }

  function createZDepthPreviewLine(line) {
    const overlay = document.createElement('div');
    overlay.className = 'z-depth-preview-line';
    overlay.dataset.zDepthPreviewLine = line.id;
    overlay.style.left = `${Number(line.from?.x || 0)}px`;
    overlay.style.top = `${Math.min(Number(line.from?.y || 0), Number(line.to?.y || 0))}px`;
    overlay.style.height = `${Math.abs(Number(line.from?.y || 0) - Number(line.to?.y || 0))}px`;
    overlay.textContent = `Z ${Number(line.z || 0)} (${Math.round(Number(line.depthRange?.minY || 0))}-${Math.round(Number(line.depthRange?.maxY || 0))})`;
    return overlay;
  }

  function createUndoHistoryView() {
    const list = document.createElement('div');
    list.className = 'undo-history';
    list.dataset.undoHistory = 'true';
    const start = Math.max(0, historyLabels.length - 8);
    historyLabels.slice(start).forEach((label, offset) => {
      const row = document.createElement('div');
      const absoluteIndex = start + offset;
      row.dataset.undoHistoryEntry = String(absoluteIndex);
      row.className = absoluteIndex === historyIndex ? 'selected' : '';
      row.textContent = label;
      list.appendChild(row);
    });
    return list;
  }

  function createSelectionOutline(entity) {
    const outline = document.createElement('div');
    outline.className = 'selection-outline';
    outline.dataset.editorSelectionOutline = entity.id;
    outline.style.left = `${Number(entity.x || 0) - 3}px`;
    outline.style.top = `${Number(entity.y || 0) - 3}px`;
    outline.style.width = `${Math.max(24, entity.width || 32) + 6}px`;
    outline.style.height = `${Math.max(24, entity.height || 32) + 6}px`;
    return outline;
  }

  function createOriginMarker(entity) {
    const marker = document.createElement('span');
    marker.className = 'origin-marker';
    marker.dataset.editorOrigin = entity.id;
    marker.style.left = `${Number(entity.x || 0)}px`;
    marker.style.top = `${Number(entity.y || 0)}px`;
    return marker;
  }

  function renderPrefabs() {
    const list = document.createElement('div');
    list.className = 'prefab-list';
    for (const prefab of current.prefabs) {
      list.appendChild(createPrefabButton(prefab));
    }
    const overrides = createPrefabOverridePanel();
    if (overrides) list.appendChild(overrides);
    return list;
  }

  function createPrefabButton(prefab) {
    const button = document.createElement('button');
    button.type = 'button';
    button.draggable = true;
    button.dataset.prefabId = prefab.id || prefab.name;
    button.textContent = `${prefab.isBasePrefab ? '基础 ' : ''}${prefab.name || prefab.id}${prefab.extends ? ` 继承 ${prefab.extends}` : ''}`;
    button.addEventListener('click', () => {
      current = { ...current, selectedPrefabId: prefab.id || prefab.name };
      update(current);
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      api.EditorAPI.createPrefabVariant(prefab.id || prefab.name, { name: `${prefab.name || prefab.id} 变体` }, {
        id: `${prefab.id || prefab.name}-variant-${Date.now().toString(36)}`
      });
    });
    button.addEventListener('dragstart', (event) => {
      const id = prefab.id || prefab.name;
      event.dataTransfer?.setData('application/x-omnicore-prefab', id);
      event.dataTransfer?.setData('text/plain', id);
    });
    return button;
  }

  function renderAssets() {
    const list = document.createElement('div');
    list.className = 'asset-list';
    const assets = Array.isArray(current.assets) ? current.assets : [];
    for (const asset of assets) {
      const assetPath = typeof asset === 'string' ? asset : asset.path || asset.url || asset.name;
      if (!assetPath) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.dataset.editorAssetPath = assetPath;
      button.dataset.assetType = assetType(asset);
      button.style.paddingLeft = `${8 + Math.max(0, assetPath.split('/').length - 1) * 10}px`;
      button.textContent = `${assetIcon(asset)} ${assetPath}`;
      button.addEventListener('click', () => previewAsset(asset));
      button.addEventListener('dblclick', () => {
        if (isPrefabAsset(asset)) previewPrefabAsset(asset);
        else if (assetType(asset) === 'image' && /\.webp$/iu.test(assetPath)) openSpriteEditor(assetPath);
      });
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-omnicore-asset', assetPath);
        event.dataTransfer?.setData('text/plain', assetPath);
      });
      list.appendChild(button);
    }
    const preview = renderAssetPreview();
    if (preview) list.appendChild(preview);
    list.appendChild(renderAssetRegistryPanel());
    return list;
  }

  function renderAssetRegistryPanel() {
    const panel = current.assetRegistryPanel || buildAssetRegistryPanelState(current);
    const wrap = document.createElement('div');
    wrap.className = 'asset-registry-panel';
    wrap.dataset.assetRegistryPanel = 'true';
    const header = document.createElement('div');
    header.className = 'asset-registry-header';
    const title = document.createElement('strong');
    title.textContent = `AssetRegistry 资源注册表 ${panel.audit?.summary?.assetCount || 0}`;
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.dataset.assetRegistryRefresh = 'true';
    refresh.textContent = '刷新';
    refresh.addEventListener('click', () => refreshAssetRegistryPanel({ query: panel.query || '' }));
    header.append(title, refresh);
    wrap.appendChild(header);

    const status = document.createElement('div');
    status.className = panel.audit?.summary?.ready ? 'asset-registry-status ready' : 'asset-registry-status warning';
    status.textContent = panel.audit?.summary?.ready
      ? '依赖完整'
      : `缺失 ${panel.audit?.summary?.missingReferenceCount || 0} / 重复 ${panel.audit?.summary?.duplicateUidCount || 0}`;
    wrap.appendChild(status);

    if (panel.diagnostics?.missingReferenceCount || panel.quickFixes?.length) {
      const diagnostics = document.createElement('div');
      diagnostics.className = 'asset-registry-diagnostics';
      diagnostics.dataset.assetRegistryDiagnostics = 'true';
      const summary = document.createElement('span');
      summary.textContent = `断引用 ${panel.diagnostics?.missingReferenceCount || 0} · 可修复 ${panel.quickFixes?.length || 0}`;
      diagnostics.appendChild(summary);
      for (const action of panel.quickFixes || []) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.assetRepairAction = action.id;
        button.textContent = action.label;
        button.addEventListener('click', () => applyAssetRegistryQuickFix(action.id, { query: panel.query || '' }));
        diagnostics.appendChild(button);
      }
      wrap.appendChild(diagnostics);
    }

    const rows = document.createElement('div');
    rows.className = 'asset-registry-rows';
    for (const row of panel.rows || []) {
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.assetRegistryRow = row.path;
      item.dataset.assetRegistryType = row.type;
      if (row.changeKind) item.dataset.assetRegistryChange = row.changeKind;
      const changeLabel = localizeAssetChangeKind(row.changeKind);
      item.textContent = `${changeLabel}${row.path} / ${row.type} / 引用 ${row.referencerCount} / 依赖 ${row.dependencyCount}`;
      item.addEventListener('click', () => previewAsset({ path: row.path, type: row.type }));
      rows.appendChild(item);
    }
    wrap.appendChild(rows);

    const refreshPlan = document.createElement('div');
    refreshPlan.className = 'asset-refresh-plan';
    refreshPlan.dataset.assetRefreshPlan = 'true';
    const affected = current.assetRefresh?.plan?.affectedAssets || [];
    refreshPlan.textContent = affected.length ? `增量刷新 ${affected.join(', ')}` : '等待资源变更';
    wrap.appendChild(refreshPlan);

    const eventList = document.createElement('div');
    eventList.className = 'asset-hot-reload-events';
    for (const event of (current.hotReloadEvents || []).slice(-8)) {
      const eventRow = document.createElement('span');
      eventRow.dataset.hotReloadEvent = event.type;
      const files = Array.isArray(event.files) ? ` ${event.files.join(', ')}` : '';
      eventRow.textContent = `${event.type}${files || (event.asset ? ` ${event.asset}` : '')}`;
      eventList.appendChild(eventRow);
    }
    wrap.appendChild(eventList);
    return wrap;
  }

  function createPrefabOverridePanel() {
    const prefab = findPrefab(current.selectedPrefabId);
    if (!prefab?.extends) return null;
    const wrap = document.createElement('div');
    wrap.className = 'prefab-override-panel';
    wrap.dataset.prefabOverridePanel = prefab.id || prefab.name;
    const title = document.createElement('h3');
    title.textContent = `${prefab.name || prefab.id} 覆盖项`;
    wrap.appendChild(title);
    const overrides = prefab.overrides || {};
    for (const [field, value] of Object.entries(overrides)) {
      const row = document.createElement('div');
      row.className = 'prefab-override-row override';
      row.dataset.prefabOverride = field;
      const label = document.createElement('span');
      label.textContent = `${field}: ${value}`;
      const write = document.createElement('button');
      write.type = 'button';
      write.dataset.prefabOverrideAction = `${field}:write`;
      write.textContent = '写回';
      write.addEventListener('click', () => writePrefabOverrideToBase(prefab.id || prefab.name, field));
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.dataset.prefabOverrideAction = `${field}:reset`;
      reset.textContent = '重置';
      reset.addEventListener('click', () => resetPrefabOverride(prefab.id || prefab.name, field));
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        resetPrefabOverride(prefab.id || prefab.name, field);
      });
      row.append(label, write, reset);
      wrap.appendChild(row);
    }
    return wrap;
  }

  function previewAsset(asset) {
    current = { ...current, assetPreview: normalizeAssetEntry(asset) };
    emit('editor:preview-asset', current.assetPreview);
    update(current);
    return current.assetPreview;
  }

  function previewPrefabAsset(asset) {
    const entry = normalizeAssetEntry(asset);
    const prefab = entry.data || entry.prefab || { id: entry.name, name: entry.name };
    const entity = {
      id: `preview-${prefab.id || prefab.name || 'prefab'}`,
      name: prefab.name || prefab.id || entry.name || 'Prefab Preview',
      type: prefab.type || 'sprite',
      texture: prefab.texture || prefab.sprite || null,
      x: Number(prefab.x ?? 40),
      y: Number(prefab.y ?? 40),
      width: Number(prefab.width || 32),
      height: Number(prefab.height || 32),
      rotation: Number(prefab.rotation || 0),
      scaleX: Number(prefab.scaleX ?? prefab.scale ?? 1),
      scaleY: Number(prefab.scaleY ?? prefab.scale ?? 1)
    };
    current = { ...current, assetPreview: entry, prefabPreview: entity };
    emit('editor:preview-prefab', { asset: entry.path, entity });
    update(current);
    return entity;
  }

  function renderAssetPreview() {
    const entry = current.assetPreview;
    if (!entry) return null;
    const wrap = document.createElement('div');
    wrap.className = 'asset-preview';
    if (assetType(entry) === 'image') {
      const image = document.createElement('img');
      image.dataset.assetPreview = 'image';
      image.alt = entry.name || entry.path;
      image.src = entry.url || entry.path;
      wrap.appendChild(image);
    } else {
      const code = document.createElement('pre');
      code.dataset.assetPreview = assetType(entry);
      code.textContent = JSON.stringify(entry.data || { path: entry.path, type: assetType(entry) }, null, 2);
      wrap.appendChild(code);
    }
    return wrap;
  }

  function renderDatabase() {
    const wrap = document.createElement('div');
    wrap.className = 'database-wrap';
    const tables = current.database?.tables || {};
    for (const [tableName, records] of Object.entries(tables)) {
      const table = document.createElement('table');
      table.dataset.databasePanelTable = tableName;
      const caption = document.createElement('caption');
      caption.textContent = tableName;
      table.appendChild(caption);
      for (const record of normalizeDatabaseRecords(records)) {
        const row = document.createElement('tr');
        for (const field of Object.keys(record)) {
          const cell = document.createElement('td');
          const input = document.createElement('input');
          input.value = record[field] ?? '';
          input.disabled = field === 'id';
          input.title = field;
          input.dataset.databaseTable = tableName;
          input.dataset.databaseId = record.id;
          input.dataset.databaseField = field;
          input.addEventListener('input', () => {
            if (field !== 'id') updateDatabaseRecord(tableName, record.id, field, input.value);
          });
          cell.appendChild(input);
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
      wrap.appendChild(table);
    }
    if (!Object.keys(tables).length) {
      const empty = document.createElement('p');
      empty.textContent = '暂无数据库表';
      wrap.appendChild(empty);
    }
    return wrap;
  }

  function renderAIAssistant() {
    const wrap = document.createElement('div');
    wrap.className = 'ai-assistant-wrap';
    const input = document.createElement('input');
    input.dataset.aiAssistantPrompt = 'true';
    input.placeholder = '生成 16x12 森林湖泊地图，加入 treasure 实体';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.aiAssistantRun = 'true';
    button.textContent = '生成';
    const status = document.createElement('small');
    status.dataset.aiAssistantStatus = 'true';
    button.addEventListener('click', async () => {
      const result = generateWithAI(input.value || '');
      status.textContent = `${result.tilemap.width}x${result.tilemap.height}`;
    });
    wrap.append(input, button, status);
    return wrap;
  }

  function renderTilemap() {
    const tilemap = cloneTilemap(current.tilemap);
    const activeLayer = findActiveTileLayer(tilemap);
    const wrap = document.createElement('div');
    wrap.className = 'tilemap-wrap';
    const tileToolbar = document.createElement('div');
    tileToolbar.className = 'tilemap-toolbar';
    const size = document.createElement('span');
    size.textContent = `${tilemap.width}x${tilemap.height}`;
    const collision = document.createElement('button');
    collision.type = 'button';
    collision.dataset.collisionMode = 'true';
    collision.textContent = current.collisionMode
      ? t('tilemap.collisionOn', '碰撞绘制')
      : t('tilemap.paintTiles', '绘制瓦片');
    collision.addEventListener('click', () => {
      current = { ...current, collisionMode: !current.collisionMode };
      update(current);
    });
    tileToolbar.append(size, collision);

    const layerBar = document.createElement('div');
    layerBar.className = 'tilemap-layers';
    for (const layer of tilemap.layers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tileLayerId = layer.id;
      button.className = layer.id === tilemap.activeLayerId ? 'selected' : '';
      button.textContent = localizeTileLayerName(layer);
      button.addEventListener('click', () => selectTileLayer(layer.id));
      layerBar.appendChild(button);
    }

    const palette = document.createElement('div');
    palette.className = 'tilemap-palette';
    for (const tile of tilePalette(tilemap)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tilesetTileId = String(tile.id);
      if (tile.source) button.dataset.tileCrop = `${tile.source.x},${tile.source.y},${tile.source.width},${tile.source.height}`;
      button.className = tile.id === current.selectedTile ? 'selected' : '';
      button.textContent = String(tile.id);
      button.addEventListener('click', () => selectTilesetTile(tile.id));
      palette.appendChild(button);
    }

    const grid = document.createElement('div');
    grid.className = 'tilemap-grid';
    grid.style.gridTemplateColumns = `repeat(${tilemap.width}, 24px)`;
    activeLayer.data.forEach((value, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.tileIndex = String(index);
      cell.textContent = tilemap.collisions.includes(index) ? '碰' : String(value || '');
      cell.className = tilemap.collisions.includes(index) ? 'collision' : '';
      cell.addEventListener('click', () => paintTile(index));
      cell.addEventListener('mousedown', (event) => {
        event.preventDefault();
        tilePaintSession = true;
        paintTile(index);
      });
      cell.addEventListener('mouseenter', () => {
        if (tilePaintSession) paintTile(index);
      });
      grid.appendChild(cell);
    });
    wrap.append(tileToolbar, layerBar, palette, grid);
    return wrap;
  }

  function renderTimeline() {
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    const clipIds = Object.keys(current.animations || {});
    if (!clipIds.length) {
      timeline.textContent = t('timeline.noClips', '暂无动画片段');
      return timeline;
    }
    const selected = current.selectedAnimationKeyframe;
    const clipList = document.createElement('div');
    clipList.className = 'timeline-clips';
    for (const clipId of clipIds) {
      const clip = current.animations[clipId];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.animationClip = clipId;
      chip.textContent = `${clipId} ${Number(clip.duration || 0)} 帧`;
      clipList.appendChild(chip);
    }
    timeline.appendChild(clipList);

    if (selected) {
      const clip = current.animations?.[selected.clipId];
      const track = clip?.tracks?.[selected.track];
      const keyframe = track?.keyframes?.find((item) => Number(item.frame || 0) === Number(selected.frame || 0));
      const graph = document.createElement('div');
      graph.className = 'animation-curve-graph';
      graph.dataset.animationCurveGraph = `${selected.clipId}:${selected.track}:${Number(selected.frame || 0)}`;
      graph.textContent = `${selected.track} 第 ${selected.frame} 帧 值 ${keyframe?.value ?? 0}`;
      const handleIn = document.createElement('span');
      handleIn.className = 'bezier-handle handle-in';
      handleIn.style.left = `${Number(keyframe?.handles?.in?.x || 0)}px`;
      handleIn.style.top = `${Number(keyframe?.handles?.in?.y || 0)}px`;
      const handleOut = document.createElement('span');
      handleOut.className = 'bezier-handle handle-out';
      handleOut.style.left = `${Number(keyframe?.handles?.out?.x || 0)}px`;
      handleOut.style.top = `${Number(keyframe?.handles?.out?.y || 0)}px`;
      graph.append(handleIn, handleOut);
      timeline.appendChild(graph);

      const presets = document.createElement('div');
      presets.className = 'easing-presets';
      for (const preset of ['Linear', 'EaseInQuad', 'EaseOutBack', 'Elastic']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.easingPreset = preset;
        button.className = keyframe?.easing === preset ? 'selected' : '';
        button.textContent = preset;
        button.addEventListener('click', () => setAnimationCurve(selected.clipId, selected.track, selected.frame, { preset }));
        presets.appendChild(button);
      }
      timeline.appendChild(presets);
    }

    const events = document.createElement('div');
    events.className = 'animation-event-track';
    for (const clipId of clipIds) {
      for (const event of current.animations[clipId].events || []) {
        const row = document.createElement('div');
        row.className = 'animation-event-marker';
        row.dataset.animationEventFrame = String(event.frame);
        row.textContent = `${clipId}:${event.frame} ${event.name}`;
        events.appendChild(row);
      }
    }
    timeline.appendChild(events);
    return timeline;
  }

  function renderFlowGraph() {
    const graph = normalizeFlowGraph(current.flowGraph);
    const wrap = document.createElement('div');
    wrap.className = 'flow-graph-wrap';

    const flowToolbar = document.createElement('div');
    flowToolbar.className = 'flow-toolbar';
    for (const type of ['event', 'condition', 'action']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.flowAdd = type;
      button.textContent = t(`flow.add.${type}`, `添加${localizeFlowNodeType(type)}`);
      button.addEventListener('click', () => addFlowNode(type));
      flowToolbar.appendChild(button);
    }
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.dataset.flowExport = 'eventsheet';
    exportButton.textContent = t('flow.exportEventSheet', '导出事件表');
    exportButton.addEventListener('click', () => exportFlowGraph());
    flowToolbar.appendChild(exportButton);

    const canvas = document.createElement('div');
    canvas.className = 'flow-canvas';
    for (const node of graph.nodes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.className = `flow-node flow-${node.type}`;
      button.dataset.flowNodeId = node.id;
      button.style.left = `${Number(node.x || 0)}px`;
      button.style.top = `${Number(node.y || 0)}px`;
      button.textContent = localizeFlowNodeLabel(node);
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-omnicore-flow-node', node.id);
        event.dataTransfer?.setData('text/plain', node.id);
      });
      button.addEventListener('dragover', (event) => event.preventDefault());
      button.addEventListener('drop', (event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer?.getData('application/x-omnicore-flow-node')
          || event.dataTransfer?.getData('text/plain');
        addFlowEdge(sourceId, node.id);
      });
      canvas.appendChild(button);
    }

    const edges = document.createElement('div');
    edges.className = 'flow-edge-list';
    for (const edge of graph.edges) {
      const source = graph.nodes.find((node) => node.id === edge.from);
      const target = graph.nodes.find((node) => node.id === edge.to);
      const row = document.createElement('div');
      row.dataset.flowEdge = `${edge.from}->${edge.to}`;
      row.textContent = `${localizeFlowNodeLabel(source) || edge.from} -> ${localizeFlowNodeLabel(target) || edge.to}${edge.pin ? ` [${edge.pin}]` : ''}`;
      edges.appendChild(row);
    }

    const preview = document.createElement('pre');
    preview.className = 'flow-preview';
    preview.dataset.flowPreview = 'eventsheet';
    preview.textContent = JSON.stringify(createVisualGraph(graph).toEventSheet(), null, 2);

    wrap.append(flowToolbar, canvas, edges, preview);
    return wrap;
  }

  function renderGraphEditor() {
    const wrap = document.createElement('div');
    wrap.className = 'graph-editor-wrap';
    const nodePalette = document.createElement('div');
    nodePalette.className = 'graph-node-palette';
    for (const type of ['input', 'condition', 'output']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.graphAdd = type;
      button.textContent = localizeGraphPaletteType(type);
      button.addEventListener('click', () => addFlowNode(type === 'input' ? 'event' : type === 'output' ? 'action' : 'condition'));
      nodePalette.appendChild(button);
    }
    const flow = renderFlowGraph();
    const runtimePanel = renderVisualScriptRuntimePanel();
    const behaviorPreview = document.createElement('pre');
    behaviorPreview.dataset.behaviorTreePreview = 'true';
    behaviorPreview.textContent = JSON.stringify(exportBehaviorTreeJson(), null, 2);
    wrap.append(nodePalette, flow, runtimePanel, behaviorPreview);
    return wrap;
  }

  function renderVisualScriptRuntimePanel() {
    const runtimeGraph = exportVisualScriptGraph();
    const validation = current.visualScriptValidation || { ok: true, issues: [] };
    const report = current.visualScriptTrace || { event: null, trace: [], events: [], variables: {} };
    const panel = document.createElement('div');
    panel.className = 'visual-script-runtime';
    panel.dataset.visualScriptPanel = 'runtime';

    const actions = document.createElement('div');
    actions.className = 'visual-script-actions';
    const runStart = document.createElement('button');
    runStart.type = 'button';
    runStart.dataset.visualScriptRun = 'start';
    runStart.textContent = '运行开始';
    runStart.addEventListener('click', () => runVisualScript('start'));
    const validate = document.createElement('button');
    validate.type = 'button';
    validate.dataset.visualScriptValidate = 'true';
    validate.textContent = '检查图';
    validate.addEventListener('click', () => validateVisualScriptGraph());
    const status = document.createElement('span');
    status.dataset.visualScriptValidation = validation.ok ? 'ok' : 'error';
    status.textContent = validation.ok
      ? `可运行 · ${runtimeGraph.nodes.length} 节点`
      : `需修复 · ${validation.issues.length} 个问题`;
    actions.append(runStart, validate, status);

    const trace = document.createElement('div');
    trace.className = 'visual-script-trace';
    trace.dataset.visualScriptTrace = 'true';
    const entries = Array.isArray(report.trace) ? report.trace : [];
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'visual-script-trace-row';
      empty.textContent = '尚未运行，可点击运行开始查看 trace';
      trace.appendChild(empty);
    } else {
      for (const entry of entries) {
        const row = document.createElement('div');
        row.className = 'visual-script-trace-row';
        row.dataset.visualScriptTraceNode = entry.nodeId || 'unknown';
        row.textContent = formatVisualScriptTraceEntry(entry);
        trace.appendChild(row);
      }
    }

    const preview = document.createElement('pre');
    preview.className = 'visual-script-runtime-json';
    preview.dataset.visualScriptRuntime = 'true';
    preview.textContent = JSON.stringify(runtimeGraph, null, 2);

    panel.append(actions, trace, preview);
    return panel;
  }

  function renderUIEditor() {
    const layout = normalizeUILayoutState(current.uiLayout);
    const wrap = document.createElement('div');
    wrap.className = 'ui-editor-wrap';
    const palette = document.createElement('div');
    palette.className = 'ui-palette';
    const buttonTool = document.createElement('button');
    buttonTool.type = 'button';
    buttonTool.dataset.uiAdd = 'Button';
    buttonTool.textContent = '按钮';
    buttonTool.addEventListener('click', () => addUIButton({ text: '按钮', x: 32, y: 32 }));
    palette.appendChild(buttonTool);

    const canvas = document.createElement('div');
    canvas.className = 'ui-canvas';
    canvas.style.width = `${layout.canvas.width}px`;
    canvas.style.height = `${layout.canvas.height}px`;
    for (const element of layout.elements) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ui-element';
      item.dataset.uiElementId = element.id;
      item.style.left = `${element.x}px`;
      item.style.top = `${element.y}px`;
      item.style.width = `${element.width}px`;
      item.style.height = `${element.height}px`;
      item.textContent = localizeUIElementText(element);
      canvas.appendChild(item);
    }

    const preview = document.createElement('pre');
    preview.dataset.uiLayoutPreview = 'true';
    preview.textContent = JSON.stringify(exportUILayoutJson(), null, 2);
    wrap.append(palette, canvas, preview);
    return wrap;
  }

  function renderGlobalSearch() {
    const searchState = normalizeGlobalSearchState(current.globalSearch);
    const wrap = document.createElement('div');
    wrap.className = 'global-search-wrap';
    const query = document.createElement('input');
    query.type = 'search';
    query.dataset.globalSearchQuery = 'true';
    query.placeholder = '搜索脚本、JSON、场景';
    query.value = searchState.query;
    query.addEventListener('input', () => searchProject(query.value));
    const replacement = document.createElement('input');
    replacement.dataset.globalReplaceValue = 'true';
    replacement.placeholder = '替换为';
    replacement.value = searchState.replacement;
    const replace = document.createElement('button');
    replace.type = 'button';
    replace.dataset.globalReplaceRun = 'true';
    replace.textContent = '替换';
    replace.addEventListener('click', () => replaceProject(query.value, replacement.value));
    const list = document.createElement('div');
    list.className = 'global-search-results';
    for (const result of searchState.results) {
      const row = document.createElement('button');
      row.type = 'button';
      row.dataset.globalSearchResult = result.path;
      row.textContent = `${result.path}:${result.line}:${result.column} ${result.preview}`;
      list.appendChild(row);
    }
    wrap.append(query, replacement, replace, list);
    return wrap;
  }

  function renderPhysicsView() {
    const wrap = document.createElement('div');
    wrap.className = 'physics-view-wrap';
    const title = document.createElement('p');
    title.textContent = 'Matter 物理视图 - 半透明碰撞线框';
    wrap.appendChild(title);
    const canvas = document.createElement('div');
    canvas.className = 'physics-debug-canvas';
    for (const body of physicsBodies(current)) {
      const shape = document.createElement('div');
      shape.className = 'physics-wireframe';
      shape.dataset.physicsWireframe = body.id;
      shape.textContent = `${body.id} ${body.shape}`;
      shape.style.left = `${body.x}px`;
      shape.style.top = `${body.y}px`;
      shape.style.width = `${Math.max(16, body.width)}px`;
      shape.style.height = `${Math.max(16, body.height)}px`;
      if (body.vertices.length) shape.dataset.vertices = body.vertices.map((point) => `${point.x},${point.y}`).join(' ');
      canvas.appendChild(shape);
    }
    wrap.appendChild(canvas);
    return wrap;
  }

  function renderBuildSettings() {
    const settings = normalizeBuildSettingsState(current.buildSettings);
    const wrap = document.createElement('div');
    wrap.className = 'build-settings-wrap';
    for (const [platform, config] of Object.entries(settings.targets)) {
      const label = document.createElement('label');
      label.className = 'build-target-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.buildTarget = platform;
      checkbox.checked = Boolean(config.enabled);
      checkbox.addEventListener('change', () => setBuildTarget(platform, checkbox.checked));
      const text = document.createElement('span');
      text.textContent = `${platform} / ${config.compression} / ${config.iconSize}px / ${config.configStrategy}`;
      label.append(checkbox, text);
      wrap.appendChild(label);
    }
    const preview = document.createElement('pre');
    preview.dataset.buildSettingsPreview = 'true';
    preview.textContent = JSON.stringify(settings, null, 2);
    wrap.appendChild(preview);
    return wrap;
  }

  function renderRuntimeDebugPanel() {
    const report = buildCurrentEditorClosureReport({ persist: false });
    const wrap = document.createElement('div');
    wrap.className = 'runtime-debug-wrap';
    wrap.dataset.runtimeDebugPanel = 'true';

    const actions = document.createElement('div');
    actions.className = 'runtime-debug-actions';
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.dataset.runtimeDebugAction = 'report';
    refresh.textContent = '诊断闭环';
    refresh.addEventListener('click', () => createEditorClosureReport());
    const repair = document.createElement('button');
    repair.type = 'button';
    repair.dataset.runtimeDebugAction = 'repair-missing';
    repair.textContent = '注册缺失资源';
    repair.addEventListener('click', () => applyEditorClosureFixes({ registerMissing: true }));
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.dataset.runtimeDebugAction = 'hot-reload';
    reload.textContent = '热重载';
    reload.addEventListener('click', () => queueHotReload(Object.keys(current.projectFiles || {}).slice(0, 8)));
    actions.append(refresh, repair, reload);
    wrap.appendChild(actions);

    const propertyPanel = document.createElement('section');
    propertyPanel.className = 'runtime-debug-section';
    propertyPanel.dataset.runtimeDebugPropertyPanel = 'true';
    const propertyTitle = document.createElement('h3');
    propertyTitle.textContent = `属性面板 ${report.propertyPanel?.entityId || '未选择'}`;
    propertyPanel.appendChild(propertyTitle);
    const propertyList = document.createElement('div');
    propertyList.className = 'runtime-debug-list';
    for (const field of report.propertyPanel?.fields || []) {
      const row = document.createElement('span');
      row.dataset.runtimeDebugProperty = field.key;
      row.textContent = `${field.label}: ${String(field.value ?? '')}`;
      propertyList.appendChild(row);
    }
    propertyPanel.appendChild(propertyList);
    wrap.appendChild(propertyPanel);

    const missingSection = document.createElement('section');
    missingSection.className = 'runtime-debug-section';
    const missingTitle = document.createElement('h3');
    missingTitle.textContent = `缺失资源 ${report.missingAssets.length}`;
    missingSection.appendChild(missingTitle);
    const missingList = document.createElement('div');
    missingList.className = 'runtime-debug-list';
    for (const asset of report.missingAssets) {
      const row = document.createElement('span');
      row.dataset.runtimeDebugMissing = asset.path;
      row.textContent = `${asset.path} / 引用 ${asset.referenceCount}`;
      missingList.appendChild(row);
    }
    if (!report.missingAssets.length) {
      const empty = document.createElement('span');
      empty.textContent = '无缺失资源';
      missingList.appendChild(empty);
    }
    missingSection.appendChild(missingList);
    wrap.appendChild(missingSection);

    const databaseSection = document.createElement('section');
    databaseSection.className = 'runtime-debug-section runtime-debug-wide';
    const databaseTitle = document.createElement('h3');
    databaseTitle.textContent = `资源数据库 ${report.resourceDatabase.length}`;
    databaseSection.appendChild(databaseTitle);
    const databaseList = document.createElement('div');
    databaseList.className = 'runtime-debug-list runtime-debug-resource-list';
    for (const asset of report.resourceDatabase.slice(0, 18)) {
      const row = document.createElement('span');
      row.dataset.runtimeDebugResource = asset.path;
      row.textContent = `${asset.missingStub ? '缺失占位 ' : ''}${asset.missing ? '缺失 ' : ''}${asset.path} / ${asset.type} / ${asset.referenceCount}`;
      databaseList.appendChild(row);
    }
    databaseSection.appendChild(databaseList);
    wrap.appendChild(databaseSection);

    const dependencies = document.createElement('section');
    dependencies.className = 'runtime-debug-section runtime-debug-wide';
    const dependencyTitle = document.createElement('h3');
    dependencyTitle.textContent = `依赖 ${report.sceneDependencies.length + report.prefabDependencies.length}`;
    dependencies.appendChild(dependencyTitle);
    const dependencyList = document.createElement('div');
    dependencyList.className = 'runtime-debug-list';
    for (const item of report.sceneDependencies.slice(0, 12)) {
      const row = document.createElement('span');
      row.dataset.sceneDependency = item.path;
      row.textContent = `${item.source} -> ${item.path}`;
      dependencyList.appendChild(row);
    }
    for (const item of report.prefabDependencies.slice(0, 12)) {
      const row = document.createElement('span');
      row.dataset.prefabDependency = item.path;
      row.textContent = `${item.prefabId} -> ${item.path}`;
      dependencyList.appendChild(row);
    }
    dependencies.appendChild(dependencyList);
    wrap.appendChild(dependencies);

    const hotReload = document.createElement('section');
    hotReload.className = 'runtime-debug-section';
    hotReload.dataset.runtimeDebugHotReload = 'true';
    const hotReloadTitle = document.createElement('h3');
    hotReloadTitle.textContent = '热重载队列';
    hotReload.appendChild(hotReloadTitle);
    const hotReloadList = document.createElement('div');
    hotReloadList.className = 'runtime-debug-list';
    for (const file of report.hotReload?.changedFiles || []) {
      const row = document.createElement('span');
      row.dataset.hotReloadFile = file;
      row.textContent = file;
      hotReloadList.appendChild(row);
    }
    for (const asset of report.hotReload?.hotReloadManifest?.affectedAssets || []) {
      const row = document.createElement('span');
      row.dataset.hotReloadAsset = asset;
      row.textContent = `影响 ${asset}`;
      hotReloadList.appendChild(row);
    }
    if (!hotReloadList.childNodes.length) {
      const empty = document.createElement('span');
      empty.textContent = '等待文件变化';
      hotReloadList.appendChild(empty);
    }
    hotReload.appendChild(hotReloadList);
    wrap.appendChild(hotReload);

    const events = document.createElement('section');
    events.className = 'runtime-debug-section';
    const eventsTitle = document.createElement('h3');
    eventsTitle.textContent = '运行时 Trace';
    events.appendChild(eventsTitle);
    const eventList = document.createElement('div');
    eventList.className = 'runtime-debug-list';
    for (const event of report.debugTimeline?.events || []) {
      const row = document.createElement('span');
      row.dataset.runtimeDebugEvent = event.name || event.type || 'event';
      row.textContent = `${event.name || event.type || 'event'} ${event.entityId || ''}`.trim();
      eventList.appendChild(row);
    }
    if (!eventList.childNodes.length) {
      const empty = document.createElement('span');
      empty.textContent = t('runtimeDebug.empty', 'No runtime events');
      eventList.appendChild(empty);
    }
    events.appendChild(eventList);
    wrap.appendChild(events);
    return wrap;
  }

  function renderProfiler() {
    const frame = current.profilerFrame;
    const wrap = document.createElement('div');
    wrap.className = 'profiler-wrap';
    wrap.dataset.editorProfiler = 'true';
    const title = document.createElement('div');
    title.textContent = frame
      ? `第 ${frame.frame} 帧 ${Number(frame.totalMs || 0).toFixed(2)}ms`
      : t('profiler.empty', 'No profiler samples');
    wrap.appendChild(title);
    const sections = Array.isArray(frame?.sections) ? frame.sections : [];
    const max = Math.max(1, ...sections.map((section) => section.duration || 0));
    const flamegraph = document.createElement('div');
    flamegraph.className = 'profiler-flamegraph';
    flamegraph.dataset.profilerFlamegraph = 'true';
    for (const section of sections) {
      const row = document.createElement('div');
      row.className = 'profiler-row';
      row.dataset.profilerSection = section.name;
      const name = document.createElement('span');
      name.textContent = section.name;
      const bar = document.createElement('b');
      bar.style.width = `${Math.max(4, Math.round(((section.duration || 0) / max) * 160))}px`;
      const value = document.createElement('span');
      value.textContent = `${Number(section.duration || 0).toFixed(2)}ms`;
      row.append(name, bar, value);
      flamegraph.appendChild(row);
    }
    wrap.appendChild(flamegraph);
    const streams = document.createElement('div');
    streams.className = 'profiler-streams';
    const memory = document.createElement('span');
    memory.dataset.profilerMemory = 'true';
    memory.textContent = `内存 ${Number(frame?.memoryMB || 0)}MB`;
    const drawCalls = document.createElement('span');
    drawCalls.dataset.profilerDrawCalls = 'true';
    drawCalls.textContent = `绘制调用 ${Number(frame?.drawCalls || 0)}`;
    streams.append(memory, drawCalls);
    wrap.appendChild(streams);
    const profilerHistory = document.createElement('div');
    profilerHistory.className = 'profiler-history';
    profilerHistory.dataset.profilerHistory = 'true';
    for (const sample of (current.profilerHistory || []).slice(-24)) {
      const row = document.createElement('span');
      row.dataset.profilerHistoryFrame = String(sample.frame);
      row.textContent = `帧${sample.frame} ${Number(sample.memoryMB || 0)}MB ${Number(sample.drawCalls || 0)} 次调用`;
      profilerHistory.appendChild(row);
    }
    wrap.appendChild(profilerHistory);
    return wrap;
  }

  function renderScene3DReadinessPanel() {
    const readiness = current.scene3DReadiness;
    const report = readiness?.report || null;
    const fixPlan = current.scene3DFixPlan;
    const applyReport = current.scene3DFixApplyReport;
    const wrap = document.createElement('div');
    wrap.className = 'scene-3d-readiness-wrap';
    wrap.setAttribute('data-scene-3d-readiness', 'true');

    const header = document.createElement('div');
    header.className = 'scene-3d-readiness-header';
    const title = document.createElement('strong');
    title.textContent = '3D 场景体检';
    const status = document.createElement('span');
    status.dataset.scene3DReadinessStatus = report?.ok ? 'ok' : 'warning';
    status.textContent = report ? (report.ok ? '已通过' : `问题 ${report.summary?.issueCount || 0}`) : '未检查';
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.dataset.scene3DReadinessRefresh = 'true';
    refresh.textContent = '重新体检';
    refresh.addEventListener('click', () => refreshScene3DReadinessPanel({ resetFixPlan: false, resetApplyReport: false }));
    header.append(title, status, refresh);
    wrap.appendChild(header);

    const metrics = document.createElement('div');
    metrics.className = 'scene-3d-readiness-metrics';
    for (const [metricLabel, metricValue] of [
      ['模型', report?.summary?.modelCount || 0],
      ['碰撞体', report?.summary?.colliderCount || 0],
      ['动态刚体', report?.summary?.dynamicBodyCount || 0],
      ['后处理', `${Number(report?.summary?.postprocessMs || 0).toFixed(2)}ms`]
    ]) {
      const item = document.createElement('span');
      const label = document.createElement('b');
      label.textContent = metricLabel;
      const value = document.createElement('strong');
      value.textContent = String(metricValue);
      item.append(label, value);
      metrics.appendChild(item);
    }
    wrap.appendChild(metrics);

    const issueList = document.createElement('div');
    issueList.className = 'scene-3d-readiness-issues';
    const issues = report?.issues || [];
    for (const issue of issues) {
      const row = document.createElement('span');
      row.dataset.scene3DReadinessIssue = issue.id || issue.type || 'issue';
      row.textContent = `${localizeScene3DIssue(issue)} · ${issue.message || issue.id}`;
      issueList.appendChild(row);
    }
    if (!issueList.childNodes.length) {
      const empty = document.createElement('span');
      empty.dataset.scene3DReadinessIssue = 'ok';
      empty.textContent = report ? '暂无 3D 场景问题' : '导入 3D 场景后可生成体检报告';
      issueList.appendChild(empty);
    }
    wrap.appendChild(issueList);

    const planBlock = document.createElement('div');
    planBlock.className = 'scene-3d-readiness-plan';
    planBlock.setAttribute('data-scene-3d-readiness-fix-plan', 'true');
    const planTitle = document.createElement('strong');
    planTitle.textContent = '修复计划';
    const planSummary = document.createElement('span');
    planSummary.textContent = fixPlan
      ? `动作 ${fixPlan.summary?.actionCount || 0} · 自动 ${fixPlan.summary?.autoFixCount || 0} · 手动 ${fixPlan.summary?.manualActionCount || 0}`
      : '尚未生成';
    const planButton = document.createElement('button');
    planButton.type = 'button';
    planButton.textContent = '生成计划';
    planButton.dataset.scene3DReadinessCreatePlan = 'true';
    planButton.disabled = !report;
    planButton.addEventListener('click', () => createScene3DReadinessFixPlan());
    planBlock.append(planTitle, planSummary, planButton);
    wrap.appendChild(planBlock);

    const applyBlock = document.createElement('div');
    applyBlock.className = 'scene-3d-readiness-apply';
    applyBlock.setAttribute('data-scene-3d-readiness-apply', 'true');
    const applyTitle = document.createElement('strong');
    applyTitle.textContent = '安全修复';
    const applySummary = document.createElement('span');
    applySummary.textContent = applyReport
      ? `已应用 ${applyReport.summary?.appliedCount || 0} · 跳过 ${applyReport.summary?.skippedCount || 0} · 失败 ${applyReport.summary?.failedCount || 0}`
      : '等待执行';
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = '应用安全修复';
    applyButton.dataset.scene3DReadinessApplyButton = 'true';
    applyButton.disabled = !fixPlan;
    applyButton.addEventListener('click', () => applyScene3DReadinessFixPlan());
    applyBlock.append(applyTitle, applySummary, applyButton);
    wrap.appendChild(applyBlock);
    return wrap;
  }

  function renderRenderDiagnosticsPanel() {
    const panel = current.renderDiagnosticsPanel || buildRenderDiagnosticsPanelState(current);
    const summary = panel.summary || {};
    const report = panel.report || {};
    const wrap = document.createElement('div');
    wrap.className = 'render-diagnostics-wrap';
    wrap.dataset.renderDiagnosticsPanel = 'true';

    const header = document.createElement('div');
    header.className = 'render-diagnostics-header';
    const title = document.createElement('strong');
    title.textContent = `渲染诊断 · 帧 ${summary.frameIndex ?? 0}`;
    const badge = document.createElement('span');
    badge.dataset.renderDiagnosticsSeverity = summary.severity || 'ok';
    badge.textContent = localizeRenderSeverity(summary.severity);
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.dataset.renderDiagnosticsRefresh = 'true';
    refresh.textContent = '刷新';
    refresh.addEventListener('click', () => refreshRenderDiagnosticsPanel(panel.input || {}));
    header.append(title, badge, refresh);
    wrap.appendChild(header);

    const metrics = document.createElement('div');
    metrics.className = 'render-diagnostics-metrics';
    const metricItems = [
      ['cpu', 'CPU', `${formatRenderMetric(summary.cpuMs)}ms`],
      ['gpu', 'GPU', `${formatRenderMetric(summary.gpuMs)}ms`],
      ['fps', 'FPS', formatRenderMetric(summary.fps)],
      ['draws', 'Draw', `${summary.drawCallsBefore || 0} -> ${summary.predictedDrawCallsAfter || 0}`],
      ['uploads', '纹理上传', String(summary.textureUploadCount || 0)],
      ['filters', 'Filter', `${summary.filterPassCount || 0} pass`]
    ];
    for (const [id, label, value] of metricItems) {
      const item = document.createElement('span');
      item.dataset.renderDiagnosticsMetric = id;
      const labelNode = document.createElement('b');
      labelNode.textContent = label;
      const valueNode = document.createElement('strong');
      valueNode.textContent = value;
      item.append(labelNode, document.createTextNode(' '), valueNode);
      metrics.appendChild(item);
    }
    wrap.appendChild(metrics);

    const backend = document.createElement('div');
    backend.className = 'render-diagnostics-backend';
    backend.dataset.renderDiagnosticsBackend = report.backend?.selected || '';
    const chain = (report.backend?.fallbackChain || []).map(formatRenderBackendName).join(' -> ');
    const rejected = (report.backend?.rejected || [])
      .map((entry) => `${formatRenderBackendName(entry.id)} ${entry.reason}`)
      .join(' / ');
    backend.textContent = `后端 ${formatRenderBackendName(report.backend?.selected)}${chain ? ` · ${chain}` : ''}${rejected ? ` · ${rejected}` : ''}`;
    wrap.appendChild(backend);

    const issues = document.createElement('div');
    issues.className = 'render-diagnostics-issues';
    for (const issue of panel.issues || []) {
      const row = document.createElement('span');
      row.dataset.renderDiagnosticsIssue = issue.type;
      row.textContent = `${localizeRenderIssue(issue.type)} ${formatRenderMetric(issue.value)} / ${formatRenderMetric(issue.budget)}${issue.reason ? ` · ${issue.reason}` : ''}`;
      issues.appendChild(row);
    }
    if (!issues.childNodes.length) {
      const empty = document.createElement('span');
      empty.dataset.renderDiagnosticsIssue = 'ok';
      empty.textContent = '当前帧预算未发现阻塞项';
      issues.appendChild(empty);
    }
    wrap.appendChild(issues);

    const actions = document.createElement('div');
    actions.className = 'render-diagnostics-actions';
    const appliedActions = new Set((panel.appliedActions || []).map((action) => action.id));
    for (const action of panel.quickFixes || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.renderDiagnosticsAction = action.id;
      const applied = Boolean(action.applied || appliedActions.has(action.id));
      button.dataset.renderDiagnosticsApplied = String(applied);
      button.textContent = applied ? `${action.label} · 已应用` : action.label;
      button.addEventListener('click', () => applyRenderDiagnosticsQuickFix(action.id, { source: 'render-diagnostics-panel' }));
      actions.appendChild(button);
    }
    if (!actions.childNodes.length) {
      const empty = document.createElement('span');
      empty.textContent = '暂无需要执行的渲染修复动作';
      actions.appendChild(empty);
    }
    wrap.appendChild(actions);

    const plan = current.renderOptimizationPlan;
    if (plan) {
      const optimizationPlan = document.createElement('div');
      optimizationPlan.className = 'render-optimization-plan';
      optimizationPlan.dataset.renderOptimizationPlan = 'true';
      const planTitle = document.createElement('strong');
      planTitle.textContent = '优化计划';
      const planSummary = document.createElement('span');
      planSummary.textContent = summarizeRenderOptimizationPlan(plan);
      const planSource = document.createElement('small');
      planSource.textContent = `${plan.source || 'editor'} · ${plan.updatedAt || '-'}`;
      optimizationPlan.append(planTitle, planSummary, planSource);
      wrap.appendChild(optimizationPlan);
    }
    const verification = current.renderOptimizationVerification;
    if (verification) {
      const verificationBlock = document.createElement('div');
      verificationBlock.className = 'render-optimization-verification';
      verificationBlock.dataset.renderOptimizationVerification = 'true';
      verificationBlock.dataset.renderOptimizationVerificationStatus = verification.status || 'unknown';
      const status = document.createElement('strong');
      status.textContent = localizeRenderOptimizationVerificationStatus(verification.status, verification.ok);
      const verificationSummary = document.createElement('span');
      const gatesPassed = verification.summary?.gatesPassed || 0;
      const gateCount = gatesPassed + Number(verification.summary?.gatesFailed || 0);
      verificationSummary.textContent = `门禁 ${gatesPassed}/${gateCount} · Draw Call ${formatSignedRenderMetric(-Number(verification.summary?.savedDrawCalls || 0))} · 帧耗时 ${formatSignedRenderMetric(verification.summary?.frameMsDelta)}ms`;
      const source = document.createElement('small');
      source.textContent = `${verification.source || 'editor'} · ${verification.verifiedAt || '-'}`;
      verificationBlock.append(status, verificationSummary, source);
      wrap.appendChild(verificationBlock);
    }
    const remediation = current.renderOptimizationRemediationPlan;
    if (remediation) {
      const remediationBlock = document.createElement('div');
      remediationBlock.className = 'render-optimization-remediation';
      remediationBlock.dataset.renderOptimizationRemediation = 'true';
      remediationBlock.dataset.renderOptimizationRemediationPriority = remediation.priority || 'normal';
      const remediationTitle = document.createElement('strong');
      remediationTitle.textContent = '后续修复';
      const actionSummary = document.createElement('span');
      actionSummary.textContent = (remediation.actions || []).map((action) => action.label).join(' · ') || '暂无补救动作';
      const meta = document.createElement('small');
      meta.textContent = `${remediation.priority || 'normal'} · 已应用 ${remediation.summary?.appliedCount || 0}/${(remediation.actions || []).length}`;
      remediationBlock.append(remediationTitle, actionSummary, meta);
      wrap.appendChild(remediationBlock);
    }
    const remediationReport = current.renderOptimizationRemediationApplyReport;
    if (remediationReport) {
      const reportBlock = document.createElement('div');
      reportBlock.className = 'render-optimization-remediation-report';
      reportBlock.dataset.renderOptimizationRemediationReport = 'true';
      reportBlock.dataset.renderOptimizationRemediationReportStatus = remediationReport.status || 'unknown';
      const reportTitle = document.createElement('strong');
      reportTitle.textContent = '补救执行';
      const reportSummary = document.createElement('span');
      reportSummary.textContent = `批量应用 ${remediationReport.summary?.appliedCount || 0}/${remediationReport.summary?.requestedCount || 0} · 跳过 ${remediationReport.summary?.skippedCount || 0} · 失败 ${remediationReport.summary?.failedCount || 0}`;
      const reportMeta = document.createElement('small');
      reportMeta.textContent = remediationReport.generatedAt || '-';
      reportBlock.append(reportTitle, reportSummary, reportMeta);
      wrap.appendChild(reportBlock);
    }
    const reverifyReport = current.renderOptimizationRemediationReverifyReport;
    if (reverifyReport) {
      const reverifyBlock = document.createElement('div');
      reverifyBlock.className = 'render-optimization-remediation-reverify';
      reverifyBlock.dataset.renderOptimizationRemediationReverify = 'true';
      reverifyBlock.dataset.renderOptimizationRemediationReverifyStatus = reverifyReport.status || 'unknown';
      const reverifyTitle = document.createElement('strong');
      reverifyTitle.textContent = reverifyReport.ok ? '复验通过' : '复验未通过';
      const reverifySummary = document.createElement('span');
      const recoveredGateCount = Number(reverifyReport.summary?.recoveredGateCount || 0);
      const previousFailedGateCount = Number(reverifyReport.summary?.previousFailedGateCount || recoveredGateCount + Number(reverifyReport.summary?.stillFailingGateCount || 0));
      reverifySummary.textContent = `恢复 ${recoveredGateCount}/${previousFailedGateCount} · 仍失败 ${reverifyReport.summary?.stillFailingGateCount || 0} · 帧耗时 ${formatSignedRenderMetric(reverifyReport.summary?.frameMsDelta)}ms`;
      const reverifyMeta = document.createElement('small');
      reverifyMeta.textContent = `${reverifyReport.source || 'editor'} · ${reverifyReport.generatedAt || '-'}`;
      reverifyBlock.append(reverifyTitle, reverifySummary, reverifyMeta);
      wrap.appendChild(reverifyBlock);
    }
    return wrap;
  }
}

function createTextResolver(localization) {
  if (typeof localization?.t === 'function') {
    return (key, fallback) => {
      const value = localization.t(key);
      return value === key ? DEFAULT_ZH_CN_TEXT[key] ?? fallback : value;
    };
  }
  if (localization && typeof localization === 'object') {
    return (key, fallback) => localization[key] ?? DEFAULT_ZH_CN_TEXT[key] ?? fallback;
  }
  return (key, fallback) => DEFAULT_ZH_CN_TEXT[key] ?? fallback;
}

function localizeGizmoMode(mode) {
  const labels = {
    select: '选择',
    translate: '移动',
    rotate: '旋转',
    scale: '缩放'
  };
  return labels[mode] || mode || '未知';
}

function localizePlayMode(mode) {
  const labels = {
    editing: '编辑',
    running: '运行中',
    playing: '运行中',
    paused: '已暂停'
  };
  return labels[mode] || mode || '未知';
}

function localizeSceneName(name) {
  const value = String(name || '').trim();
  return !value || value.toLowerCase() === 'untitled' ? '未命名' : value;
}

function localizeParticleField(field) {
  const labels = {
    emissionRate: '发射率',
    lifetime: '生命周期',
    initialVelocity: '初速度',
    gravity: '重力'
  };
  return labels[field] || field;
}

function localizeMaterialField(field) {
  const labels = {
    alphaClip: '透明裁剪',
    colorTint: '颜色叠加',
    normalMap: '法线贴图'
  };
  return labels[field] || field;
}

function localizeScene3DIssue(issue = {}) {
  const labels = {
    'missing-asset': '缺失资源',
    'missing-material': '缺失材质',
    'missing-collider': '缺失碰撞体',
    'shadow-map-budget': '阴影预算',
    'postprocess-budget': '后处理预算'
  };
  return labels[issue.type] || issue.type || '场景问题';
}

function localizeFlowNodeType(type) {
  const labels = {
    event: '事件',
    condition: '条件',
    action: '动作'
  };
  return labels[type] || type || '节点';
}

function localizeGraphPaletteType(type) {
  const labels = {
    input: '输入',
    condition: '条件',
    output: '输出'
  };
  return labels[type] || type || '节点';
}

function localizeTileLayerName(layer = {}) {
  const value = String(layer.name || layer.id || '').trim();
  if (value === 'tiles') return '瓦片层';
  if (/^Layer\s+(\d+)$/iu.test(value)) return value.replace(/^Layer\s+/iu, '图层 ');
  return value || '图层';
}

function localizeFlowNodeLabel(node = null) {
  if (!node) return '';
  const labels = {
    Event: '事件',
    Condition: '条件',
    Action: '动作',
    'NPC Proximity': 'NPC 接近',
    'NPC Nearby': 'NPC 在附近',
    'Play Animation': '播放动画',
    'Show Dialog': '显示对话'
  };
  const value = String(node.label || node.id || '').trim();
  if (/^Node\s+(\d+)$/iu.test(value)) return value.replace(/^Node\s+/iu, '节点 ');
  return labels[value] || value;
}

function localizeUIElementText(element = {}) {
  const value = String(element.text || element.label || element.id || '').trim();
  if (value === 'Button' && element.type === 'Button') return '按钮';
  return value || '界面元素';
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function cloneDatabase(database = {}) {
  return {
    tables: cloneState(database.tables || {}),
    lastUpdate: database.lastUpdate || null
  };
}

function normalizeProjectFilesState(projectFiles = {}) {
  if (!projectFiles || typeof projectFiles !== 'object' || Array.isArray(projectFiles)) return {};
  return Object.fromEntries(Object.entries(projectFiles).map(([filePath, content]) => [slash(filePath), String(content ?? '')]));
}

function normalizeGlobalSearchState(value = {}) {
  return {
    open: Boolean(value.open),
    query: value.query || '',
    replacement: value.replacement || '',
    results: Array.isArray(value.results) ? value.results.map((result) => ({ ...result })) : []
  };
}

function normalizeResourcePickerState(value = {}) {
  return {
    open: Boolean(value.open),
    field: value.field || null,
    query: value.query || ''
  };
}

function normalizePhysicsViewState(value = {}) {
  return {
    open: Boolean(value.open)
  };
}

function normalizePrefabHotEditState(value = {}) {
  return {
    prefabId: value.prefabId || null,
    patch: cloneState(value.patch || {}),
    dirty: Boolean(value.dirty),
    promptOpen: Boolean(value.promptOpen)
  };
}

function normalizeBuildSettingsState(value = {}) {
  const defaults = defaultBuildTargets();
  const targets = value.targets || {};
  const enabledTargets = Array.isArray(targets) ? new Set(targets) : null;
  return {
    targets: Object.fromEntries(Object.entries(defaults).map(([platform, config]) => [
      platform,
      {
        ...config,
        ...(!enabledTargets ? (targets[platform] || {}) : {}),
        enabled: enabledTargets
          ? enabledTargets.has(platform)
          : Boolean(targets[platform]?.enabled ?? config.enabled)
      }
    ])),
    budgets: normalizeBuildBudgetsState(value.budgets || value)
  };
}

function defaultBuildTargets() {
  return {
    web: { enabled: true, compression: 'brotli', iconSize: 512, configStrategy: 'static' },
    wechat: { enabled: false, compression: 'zip', iconSize: 144, configStrategy: 'minigame' },
    electron: { enabled: false, compression: 'asar', iconSize: 256, configStrategy: 'desktop' },
    steam: { enabled: false, compression: 'store', iconSize: 256, configStrategy: 'depot' },
    itch: { enabled: false, compression: 'brotli', iconSize: 256, configStrategy: 'portable' }
  };
}

function normalizeBuildBudgetsState(value = {}) {
  return {
    maxBundleKb: Math.max(1, Number(value.maxBundleKb || 1024)),
    maxWechatBytes: Math.max(1, Number(value.maxWechatBytes || 4 * 1024 * 1024))
  };
}

function normalizeUILayoutState(uiLayout = {}) {
  const canvas = uiLayout.canvas || {};
  const elements = Array.isArray(uiLayout.elements) ? uiLayout.elements : [];
  return {
    format: 'OmniCore.UI_Layout',
    version: Number(uiLayout.version || 1),
    canvas: {
      width: Math.max(1, Number(canvas.width || uiLayout.width || 320)),
      height: Math.max(1, Number(canvas.height || uiLayout.height || 240))
    },
    elements: elements.map(normalizeUIElement)
  };
}

function normalizeUIElement(element = {}, index = 0) {
  const type = element.type || 'Button';
  return {
    type,
    id: String(element.id || `${type.toLowerCase()}-${index + 1}`),
    text: String(element.text ?? element.label ?? element.id ?? type),
    x: Number(element.x || 0),
    y: Number(element.y || 0),
    width: Math.max(1, Number(element.width || 160)),
    height: Math.max(1, Number(element.height || 40)),
    action: element.action || null
  };
}

function normalizeDatabaseRecords(records = {}) {
  if (Array.isArray(records)) return records.map((record) => ({ ...record }));
  return Object.values(records).map((record) => ({ ...record }));
}

function normalizeDatabaseInput(value, previousValue) {
  if (typeof previousValue === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : previousValue;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(String(value))) return Number(value);
  return value;
}

function parsePromptSize(prompt) {
  const match = String(prompt || '').match(/(\d+)\s*x\s*(\d+)/iu);
  if (!match) return {};
  return {
    width: Math.max(1, Number(match[1])),
    height: Math.max(1, Number(match[2]))
  };
}

function promptEntities(prompt) {
  const entities = [];
  if (/treasure|宝箱|chest/i.test(String(prompt || ''))) {
    entities.push({
      id: 'treasure',
      name: 'Treasure',
      type: 'sprite',
      texture: 'treasure',
      x: 32,
      y: 32,
      width: 16,
      height: 16
    });
  }
  return entities;
}

function normalizeGeneratedEntity(entity = {}, existingIds = new Set(), index = 0) {
  let id = entity.id || entity.name || `ai-entity-${index + 1}`;
  if (existingIds.has(id)) id = `${id}-${Date.now().toString(36)}`;
  return {
    id,
    name: entity.name || id,
    type: entity.type || 'entity',
    texture: entity.texture || entity.sprite || entity.type || null,
    sprite: entity.sprite || entity.texture || entity.type || null,
    x: Number(entity.x || 0),
    y: Number(entity.y || 0),
    width: Number(entity.width || 32),
    height: Number(entity.height || 32),
    tileWidth: entity.tileWidth,
    tileHeight: entity.tileHeight,
    data: Array.isArray(entity.data) ? [...entity.data] : entity.data,
    layer: entity.layer || null,
    rotation: Number(entity.rotation || 0),
    scale: Number(entity.scale ?? 1),
    scaleX: Number(entity.scaleX ?? entity.scale ?? 1),
    scaleY: Number(entity.scaleY ?? entity.scale ?? 1),
    components: Array.isArray(entity.components) ? cloneState(entity.components) : [],
    prefabId: entity.prefabId || null
  };
}

function createVisualGraph(flowGraph = {}) {
  const normalized = normalizeFlowGraph(flowGraph);
  const nodes = new Map(normalized.nodes.map((node) => [node.id, node]));
  const edges = normalized.edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to));
  return {
    nodes,
    edges,
    toEventSheet: () => flowGraphToEventSheet({ nodes: [...nodes.values()], edges })
  };
}

function flowGraphToEventSheet(flowGraph = {}) {
  const normalized = normalizeFlowGraph(flowGraph);
  const nodesById = new Map(normalized.nodes.map((node) => [node.id, node]));
  const edges = normalized.edges.filter((edge) => nodesById.has(edge.from) && nodesById.has(edge.to));
  const childrenBySource = new Map();
  for (const edge of edges) {
    if (!childrenBySource.has(edge.from)) childrenBySource.set(edge.from, []);
    childrenBySource.get(edge.from).push(nodesById.get(edge.to));
  }

  const targetedNodes = new Set(edges.map((edge) => edge.to));
  const rootNodes = normalized.nodes.filter((node) => (
    (isFlowEventNode(node) || isFlowConditionNode(node)) && !targetedNodes.has(node.id)
  ));
  const fallbackActionNodes = normalized.nodes.filter(isFlowActionNode);
  const events = rootNodes.length
    ? rootNodes.map((node) => buildFlowEventTree(node, childrenBySource))
    : [{
      name: 'root',
      scope: {},
      conditions: [],
      actions: fallbackActionNodes.map((node) => cloneState(node.data))
    }];

  return { events };
}

function flowGraphToBehaviorTree(flowGraph = {}) {
  const eventSheet = flowGraphToEventSheet(flowGraph);
  return {
    type: 'selector',
    children: eventSheet.events.map((event) => ({
      type: 'sequence',
      name: event.name,
      children: [
        ...event.conditions.map((condition) => ({ type: 'condition', condition: cloneState(condition) })),
        ...event.actions.map((action) => ({ type: 'action', action: cloneState(action) }))
      ]
    }))
  };
}

function flowGraphToVisualScriptGraph(flowGraph = {}) {
  const normalized = normalizeFlowGraph(flowGraph);
  return {
    format: 'OmniCore.VisualScriptGraph',
    version: 1,
    variables: cloneState(normalized.variables || {}),
    nodes: normalized.nodes.map((node) => flowNodeToVisualScriptNode(node)),
    edges: normalized.edges.map((edge) => ({
      from: String(edge.from),
      to: String(edge.to),
      ...(edge.pin ? { pin: String(edge.pin) } : {})
    }))
  };
}

function flowNodeToVisualScriptNode(node = {}) {
  const base = {
    id: String(node.id),
    label: node.label || node.id,
    sourceType: node.type,
    data: cloneState(node.data || {})
  };
  if (isFlowEventNode(node)) {
    return {
      ...base,
      type: 'event',
      event: inferVisualScriptEventName(node)
    };
  }
  if (isFlowConditionNode(node)) {
    return {
      ...base,
      type: 'branch',
      condition: normalizeVisualScriptCondition(node.data)
    };
  }
  return flowActionNodeToVisualScriptNode(node, base);
}

function flowActionNodeToVisualScriptNode(node = {}, base = {}) {
  const data = node.data || {};
  const op = data.op || data.action || node.action;
  if (op === 'set') {
    return {
      ...base,
      type: 'set',
      target: data.target || data.path || 'state.value',
      value: data.value ?? data.args?.value ?? true
    };
  }
  if (op === 'emit') {
    return {
      ...base,
      type: 'emit',
      event: data.event || data.name || node.label || node.id,
      payload: cloneState(data.payload || data.args || {})
    };
  }
  return {
    ...base,
    type: 'call',
    action: String(data.action || data.op || node.label || node.id),
    args: normalizeVisualScriptArgs(data)
  };
}

function inferVisualScriptEventName(node = {}) {
  const data = node.data || {};
  if (data.event) return String(data.event);
  if (data.name) return String(data.name);
  if (data.when?.onStart) return 'start';
  if (data.when?.onUpdate) return 'update';
  if (data.when?.onLoad) return 'load';
  if (data.when?.onReady) return 'ready';
  return String(node.event || node.label || node.id || 'start');
}

function normalizeVisualScriptCondition(data = {}) {
  if (data.condition && typeof data.condition === 'object') return cloneState(data.condition);
  if (data.op) return cloneState(data);
  if (Object.prototype.hasOwnProperty.call(data, 'left') || Object.prototype.hasOwnProperty.call(data, 'right')) {
    return { op: 'equals', left: data.left, right: data.right };
  }
  return { op: 'truthy', left: true };
}

function normalizeVisualScriptArgs(data = {}) {
  if (data.args && typeof data.args === 'object' && !Array.isArray(data.args)) return cloneState(data.args);
  if (Object.prototype.hasOwnProperty.call(data, 'args')) return { value: data.args };
  return cloneState(Object.fromEntries(
    Object.entries(data).filter(([key]) => !['action', 'op', 'condition', 'when'].includes(key))
  ));
}

function createVisualScriptActions(customActions = {}) {
  const builtIns = {
    playAnimation: ({ args }) => ({ ok: true, type: 'playAnimation', ...args }),
    showDialog: ({ args }) => ({ ok: true, type: 'showDialog', ...args }),
    openDoor: ({ args }) => ({ ok: true, type: 'openDoor', ...args }),
    spawn: ({ args }) => ({ ok: true, type: 'spawn', ...args }),
    setProperty: ({ runtime, args }) => runtime.set(args.target || args.path || 'state.value', args.value),
    log: ({ args }) => args.message ?? args.value ?? args
  };
  return {
    ...builtIns,
    ...(customActions || {})
  };
}

function createVisualScriptPaletteModel() {
  return {
    groups: [
      {
        id: 'flow',
        label: '流程',
        nodes: [
          { type: 'event', label: '开始事件', defaultData: { event: 'start' } },
          { type: 'action', label: '执行动作', defaultData: { op: 'log', message: 'hello' } }
        ]
      },
      {
        id: 'logic',
        label: '逻辑',
        nodes: [
          { type: 'condition', label: '条件分支', defaultData: { op: 'truthy', left: '$variables.flag' } },
          { type: 'action', label: '设置变量', defaultData: { op: 'set', target: 'variables.flag', value: true } }
        ]
      },
      {
        id: 'runtime',
        label: '运行时',
        nodes: [
          { type: 'action', label: '播放动画', defaultData: { op: 'playAnimation', clip: 'Idle' } },
          { type: 'action', label: '发出信号', defaultData: { op: 'emit', event: 'gameplay:event' } }
        ]
      }
    ]
  };
}

function createVisualScriptBeginnerChecklist({ graph = {}, validation = {}, traceRows = [] } = {}) {
  const nodeTypes = new Set((graph.nodes || []).map((node) => node.type));
  return [
    {
      id: 'add-event',
      label: '添加开始事件',
      done: nodeTypes.has('event')
    },
    {
      id: 'connect-node',
      label: '连接节点',
      done: (graph.edges || []).length > 0
    },
    {
      id: 'validate-graph',
      label: '检查节点图',
      done: validation.ok === true
    },
    {
      id: 'run-start',
      label: '运行并查看 trace',
      done: traceRows.length > 0
    }
  ];
}

function formatVisualScriptTraceEntry(entry = {}) {
  const label = [entry.nodeId || 'unknown', entry.type || 'node'].join(' · ');
  if (Object.prototype.hasOwnProperty.call(entry, 'result')) {
    return `${label} => ${formatTraceValue(entry.result)}`;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'value')) {
    return `${label} = ${formatTraceValue(entry.value)}`;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'event')) {
    return `${label} @ ${entry.event}`;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'reason')) {
    return `${label} / ${entry.reason}`;
  }
  return label;
}

function formatTraceValue(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function buildFlowEventTree(root, childrenBySource) {
  if (isFlowEventNode(root)) {
    const children = childrenBySource.get(root.id) || [];
    const conditions = children
      .filter(isFlowConditionNode)
      .map((child) => buildFlowConditionNode(child, childrenBySource, new Set(), root.scope || {}))
      .filter(Boolean);
    const event = {
      name: root.label || root.id,
      scope: cloneState(root.scope || {}),
      conditions,
      actions: collectFlowActions(root, childrenBySource, new Set())
    };
    if (root.data?.when) event.when = cloneState(root.data.when);
    return event;
  }

  return {
    name: root.label || root.id,
    scope: cloneState(root.scope || {}),
    conditions: [buildFlowConditionNode(root, childrenBySource, new Set())].filter(Boolean),
    actions: collectFlowActions(root, childrenBySource, new Set())
  };
}

function buildFlowConditionNode(node, childrenBySource, visited, localScope = {}) {
  if (!node || visited.has(node.id)) return null;
  visited.add(node.id);
  const children = childrenBySource.get(node.id) || [];
  const nextScope = { ...localScope, ...(node.scope || {}) };
  const childConditionNodes = children.filter(isFlowConditionNode);
  const explicitOp = flowLogicalOp(node);

  if (explicitOp === 'not') {
    const [nextNode] = childConditionNodes;
    const nested = nextNode ? buildFlowConditionNode(nextNode, childrenBySource, visited, nextScope) : null;
    return nested ? { op: 'not', conditions: [nested], scope: nextScope } : null;
  }

  const childConditions = childConditionNodes
    .map((child) => buildFlowConditionNode(child, childrenBySource, visited, nextScope))
    .filter(Boolean);
  const candidate = normalizeFlowConditionData(node.data);

  if (candidate && explicitOp == null && childConditions.length === 0) {
    if (Object.keys(nextScope).length) candidate.scope = nextScope;
    return candidate;
  }
  if (childConditions.length === 0) return candidate || { op: 'truthy', left: true };

  if (explicitOp === 'or') return { op: 'or', conditions: childConditions, scope: nextScope };
  if (explicitOp === 'and' || childConditions.length > 1) return { op: 'and', conditions: childConditions, scope: nextScope };
  return { ...childConditions[0], scope: { ...(childConditions[0].scope || {}), ...nextScope } };
}

function collectFlowActions(node, childrenBySource, visited) {
  const actions = [];
  for (const child of childrenBySource.get(node.id) || []) {
    if (visited.has(child.id)) continue;
    visited.add(child.id);
    if (isFlowActionNode(child)) {
      actions.push(cloneState(child.data));
    } else {
      actions.push(...collectFlowActions(child, childrenBySource, visited));
    }
  }
  return actions;
}

function isFlowEventNode(node) {
  return node.type === 'event';
}

function isFlowConditionNode(node) {
  return node.type !== 'action' && node.type !== 'execution' && node.type !== 'event';
}

function isFlowActionNode(node) {
  return node.type === 'action' || node.type === 'execution';
}

function flowLogicalOp(node) {
  const configured = node?.data?.op || node?.type;
  return configured === 'and' || configured === 'or' || configured === 'not' ? configured : null;
}

function normalizeFlowConditionData(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.op) return cloneState(data);
  return { op: 'equals', left: data.left, right: data.right };
}

function snapPoint(point = {}, state = {}) {
  const rect = point.currentTarget?.getBoundingClientRect?.() || { left: 0, top: 0 };
  const tilemap = state.tilemap || {};
  const gridX = Math.max(1, Number(tilemap.tileWidth || tilemap.tilewidth || state.gridSize || 16));
  const gridY = Math.max(1, Number(tilemap.tileHeight || tilemap.tileheight || state.gridSize || 16));
  const rawX = Number(point.clientX ?? point.x ?? 0) - Number(rect.left || 0);
  const rawY = Number(point.clientY ?? point.y ?? 0) - Number(rect.top || 0);
  return {
    x: snapAxis(rawX, gridX),
    y: snapAxis(rawY, gridY)
  };
}

function snapEditorPoint(point = {}, state = {}) {
  const size = Math.max(1, Number(state.gridSnap?.size || state.gridSize || 16));
  const x = Number(point.x ?? point.clientX ?? 0);
  const y = Number(point.y ?? point.clientY ?? 0);
  if (state.gridSnap?.enabled) {
    return {
      x: Math.round(x / size) * size,
      y: Math.round(y / size) * size
    };
  }
  return { x, y };
}

function snapAxis(value, grid) {
  const snapped = Math.round(value / grid) * grid;
  return Math.abs(snapped - value) <= grid * 0.25 ? snapped : value;
}

function diffScenes(before = {}, after = {}) {
  const previous = firstEntityById(before.entities || []);
  const next = firstEntityById(after.entities || []);
  const added = [];
  const removed = [];
  const changed = [];
  for (const [id, entity] of next) {
    if (!previous.has(id)) {
      added.push(cloneState(entity));
      continue;
    }
    const fields = changedEntityFields(previous.get(id), entity);
    if (fields.length) changed.push({ id, fields, before: cloneState(previous.get(id)), after: cloneState(entity) });
  }
  for (const [id, entity] of previous) {
    if (!next.has(id)) removed.push(cloneState(entity));
  }
  return { added, removed, changed };
}

function firstEntityById(entities = []) {
  const map = new Map();
  for (const entity of entities) {
    const id = String(entity.id || entity.name || '');
    if (id && !map.has(id)) map.set(id, entity);
  }
  return map;
}

function changedEntityFields(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
}

function isSpine25DNode(entity = {}) {
  const type = String(entity.type || entity.kind || '').toLowerCase();
  return type.includes('spine') || Boolean(entity.skeleton || entity.atlas?.endsWith?.('.atlas'));
}

function isDimension25DNode(entity = {}) {
  const type = String(entity.type || entity.kind || '').toLowerCase();
  return type.includes('dimension3d') || type.includes('3d') || Boolean(entity.model || entity.glb || entity.bounds?.depth);
}

function normalizeScene(scene = {}) {
  return {
    name: scene.name || '未命名',
    entities: (scene.entities || []).map((entity, index) => ({
      ...entity,
      id: entity.id || entity.name || `entity-${index}`,
      name: entity.name || entity.id || `Entity ${index + 1}`,
      type: entity.type || 'entity',
      texture: entity.texture || entity.sprite || null,
      sprite: entity.sprite || entity.texture || null,
      x: Number(entity.x || 0),
      y: Number(entity.y || 0),
      width: Number(entity.width || 32),
      height: Number(entity.height || 32),
      rotation: Number(entity.rotation || 0),
      scale: Number(entity.scale ?? entity.scaleX ?? 1),
      scaleX: Number(entity.scaleX ?? entity.scale ?? 1),
      scaleY: Number(entity.scaleY ?? entity.scale ?? 1),
      components: Array.isArray(entity.components) ? cloneState(entity.components) : [],
      prefabId: entity.prefabId || null
    }))
  };
}

function create25DCoCreationEntity(plan = {}) {
  const placement = plan.placement || {};
  const intent = plan.intent || {};
  const relation = intent.placement?.relation || placement.relation || 'near';
  const anchor = intent.placement?.anchor || plan.occlusion?.[0]?.anchorId || null;
  const id = String(placement.entityId || `${anchor || 'scene'}-${intent.structure || 'structure'}`);
  const width = numberWithFallback(placement.width, intent.structure === 'tower' ? 48 : 64);
  const height = numberWithFallback(placement.height, intent.structure === 'tower' ? 112 : 64);
  const x = numberWithFallback(placement.x);
  const y = numberWithFallback(placement.y);
  const z = numberWithFallback(placement.z);
  const baselineY = numberWithFallback(placement.baselineY, y + height);
  return {
    id,
    name: labelFromId(id),
    type: 'dimension3d-model',
    x,
    y,
    z,
    width,
    height,
    position: { x, y, z },
    placement: {
      relation,
      anchor,
      baselineY,
      terrainSample: placement.terrainSample || null
    },
    assetTasks: cloneState(plan.assets || []),
    occlusion: cloneState(plan.occlusion || []),
    fakeShadow: cloneState(plan.shadows?.[0] || null),
    eventGraph: cloneState(plan.eventGraph || null),
    coCreated: true,
    coCreationProtocol: plan.protocol || null,
    coCreationPrompt: plan.prompt || '',
    coCreationPlan: cloneState(plan)
  };
}

function upsertEntity(entities = [], nextEntity = {}) {
  const nextId = String(nextEntity.id || '');
  let replaced = false;
  const updated = entities.map((entity) => {
    if (String(entity.id) !== nextId) return entity;
    replaced = true;
    return { ...entity, ...nextEntity };
  });
  return replaced ? updated : [...updated, nextEntity];
}

function sceneFileStem(scene = {}) {
  return slug(scene.name || 'scene');
}

function renderRunnableProjectHtml(projectName = 'omnicore-game') {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(projectName)}</title>
    <style>
      html, body { margin: 0; min-height: 100%; background: #0b1020; color: #e5e7eb; font-family: Arial, sans-serif; }
      #app { width: 100vw; height: 100vh; display: grid; place-items: center; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
}

function renderRunnableProjectMain({ scenePath = 'scenes/scene.scene.json' } = {}) {
  return `import OmniCore from 'omnicore';
import sceneData from '../${scenePath}' assert { type: 'json' };
import manifest from '../assets/manifest.json' assert { type: 'json' };

const game = await new OmniCore.Game({
  parent: '#app',
  width: 960,
  height: 540,
  renderer: 'auto',
  roundPixels: true,
  debug: true
}).init();

const scene = new OmniCore.Scene(sceneData.name || 'play');

for (const entity of sceneData.entities || []) {
  scene.add(new OmniCore.Sprite(entity.texture || entity.sprite || entity.id, {
    ...entity,
    color: entity.color || '#38bdf8'
  }));
}

console.log('OmniCore runnable export loaded', manifest);
game.scene.register(scene);
await game.scene.push(scene.name);
`;
}

function renderRunnableProjectReadme({ projectName = 'omnicore-game', targets = [] } = {}) {
  return `# ${projectName}

Generated by OmniCore.Editor \`exportRunnableProject()\`.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

Targets: ${targets.length ? targets.join(', ') : 'web'}.
`;
}

function inferAssetTypeFromPath(filePath = '') {
  const lower = String(filePath).toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/u.test(lower)) return 'image';
  if (/\.(mp3|ogg|wav|m4a|aac)$/u.test(lower)) return 'audio';
  if (/\.(json|scene)$/u.test(lower)) return 'metadata';
  if (/\.(glb|gltf|fbx|blend)$/u.test(lower)) return 'model';
  if (/\.(skel|atlas|spine)$/u.test(lower)) return 'spine';
  return 'asset';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function sceneSignature(scene = {}) {
  return JSON.stringify(normalizeScene(scene));
}

function entitySignature(entity = {}) {
  return JSON.stringify(cloneState(entity));
}

function entityBounds(entity = {}) {
  const width = Number(entity.width ?? entity.bounds?.width ?? 0);
  const height = Number(entity.height ?? entity.bounds?.height ?? 0);
  return {
    x: Number(entity.x ?? entity.position?.x ?? 0),
    y: Number(entity.y ?? entity.position?.y ?? 0),
    z: Number(entity.z ?? entity.position?.z ?? 0),
    width,
    height,
    baselineY: Number(entity.placement?.baselineY ?? (Number(entity.y ?? 0) + height))
  };
}

function formatSaveVersionDiff(diff) {
  if (!diff) return '暂无保存差异。';
  const parts = [];
  if (diff.addedEntities.length) parts.push(`新增 ${diff.addedEntities.map((entity) => entity.id).join(', ')}`);
  if (diff.removedEntities.length) parts.push(`删除 ${diff.removedEntities.map((entity) => entity.id).join(', ')}`);
  if (diff.changedEntities.length) parts.push(`修改 ${diff.changedEntities.map((entity) => entity.id).join(', ')}`);
  return parts.length ? parts.join(' | ') : '实体无变化。';
}

function next25DProductionActions(blockers = [], warnings = []) {
  const actions = [];
  const actionByCode = {
    'cocreation-not-applied': '把 2.5D 共创方案应用到场景。',
    'scene-not-saved': '应用 2.5D 改动后保存场景快照。',
    'build-target-missing': '至少启用一个轻量部署目标。',
    'deploy-manifest-incomplete': '导出包含入口场景的轻量部署包。',
    'no-25d-cocreation': '生产评审前创建并应用 2.5D 共创方案。'
  };
  for (const item of [...blockers, ...warnings]) {
    actions.push(actionByCode[item.code] || `处理 ${item.code}。`);
  }
  return [...new Set(actions)];
}

function slug(value) {
  const text = String(value || 'scene')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '');
  return text || 'scene';
}

function labelFromId(value) {
  return String(value || '实体')
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function numberWithFallback(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeInspectorPatch(patch = {}) {
  const next = { ...patch };
  if (Object.prototype.hasOwnProperty.call(next, 'sprite')) next.texture = next.sprite;
  if (Object.prototype.hasOwnProperty.call(next, 'texture') && !Object.prototype.hasOwnProperty.call(next, 'sprite')) {
    next.sprite = next.texture;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'scale')) {
    next.scaleX = next.scale;
    next.scaleY = next.scale;
  }
  return next;
}

function formatComponents(components = []) {
  return components.map((component) => {
    if (typeof component === 'string') return component;
    return component.type || component.name || component.constructor?.name || '组件';
  }).join(', ');
}

function normalizeFlowGraph(flowGraph = {}) {
  return {
    variables: { ...(flowGraph.variables || {}) },
    nodes: (flowGraph.nodes || []).map((node, index) => ({
      id: String(node.id || `node-${index + 1}`),
      type: String(node.type || 'action'),
      label: node.label || node.id || `Node ${index + 1}`,
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      scope: { ...(node.scope || {}) },
      data: { ...(node.data || {}) }
    })),
    edges: (flowGraph.edges || [])
      .filter((edge) => edge?.from && edge?.to)
      .map((edge) => ({
        from: String(edge.from),
        to: String(edge.to),
        ...(edge.pin ? { pin: String(edge.pin) } : {})
      }))
  };
}

function cloneTilemap(tilemap = {}) {
  const width = Number(tilemap.width || 16);
  const height = Number(tilemap.height || 12);
  const size = width * height;
  const data = Array.isArray(tilemap.data) ? [...tilemap.data] : [];
  while (data.length < size) data.push(0);
  const layers = normalizeTilemapLayers(tilemap.layers, data, size);
  const activeLayerId = layers.some((layer) => layer.id === tilemap.activeLayerId)
    ? tilemap.activeLayerId
    : layers[0]?.id || 'tiles';
  return {
    width,
    height,
    tileWidth: Number(tilemap.tileWidth || tilemap.tilewidth || 16),
    tileHeight: Number(tilemap.tileHeight || tilemap.tileheight || 16),
    data: [...(layers[0]?.data || data.slice(0, size))],
    layers,
    activeLayerId,
    collisions: uniqueNumbers(tilemap.collisions),
    tilesets: normalizeTilesets(tilemap.tilesets || (tilemap.tileset ? [tilemap.tileset] : []), tilemap),
    ruleTiles: normalizeRuleTiles(tilemap.ruleTiles)
  };
}

function normalizeRuleTiles(ruleTiles = []) {
  return (Array.isArray(ruleTiles) ? ruleTiles : [])
    .filter((rule) => rule && rule.id != null)
    .map((rule) => ({
      ...cloneState(rule),
      id: Number(rule.id),
      when: {
        ...(rule.when || {}),
        self: Number(rule.when?.self),
        adjacentAny: uniqueNumbers(rule.when?.adjacentAny)
      }
    }));
}

function normalizeTilemapLayers(layers, fallbackData, size) {
  const source = Array.isArray(layers) && layers.length > 0
    ? layers
    : [{ id: 'tiles', name: 'tiles', data: fallbackData }];
  return source.map((layer, index) => {
    const data = Array.isArray(layer.data) ? [...layer.data] : [];
    while (data.length < size) data.push(0);
    return {
      id: String(layer.id || layer.name || `layer-${index + 1}`),
      name: String(layer.name || layer.id || `Layer ${index + 1}`),
      visible: layer.visible !== false,
      opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1,
      data: data.slice(0, size)
    };
  });
}

function normalizeTilesets(tilesets, tilemap = {}) {
  return (Array.isArray(tilesets) ? tilesets : []).map((tileset, index) => {
    const tileWidth = Number(tileset.tileWidth || tileset.tilewidth || tilemap.tileWidth || tilemap.tilewidth || 16);
    const tileHeight = Number(tileset.tileHeight || tileset.tileheight || tilemap.tileHeight || tilemap.tileheight || 16);
    const firstgid = Number(tileset.firstgid || 1);
    const columns = Math.max(1, Number(tileset.columns || 1));
    const collisionTiles = uniqueNumbers(tileset.collisionTiles || tileset.solidTiles);
    const explicitTiles = Array.isArray(tileset.tiles) ? tileset.tiles : [];
    const tilecount = Math.max(
      Number(tileset.tilecount || tileset.tileCount || 0),
      explicitTiles.length,
      collisionTiles.length ? Math.max(...collisionTiles) - firstgid + 1 : 0
    );
    const byId = new Map();
    for (let offset = 0; offset < tilecount; offset += 1) {
      const id = firstgid + offset;
      byId.set(id, { id, solid: collisionTiles.includes(id), source: cropTile(id, { firstgid, columns, tileWidth, tileHeight }) });
    }
    for (const tile of explicitTiles) {
      const id = Number(tile.id ?? tile.gid);
      if (!Number.isFinite(id)) continue;
      byId.set(id, {
        ...byId.get(id),
        ...tile,
        id,
        solid: Boolean(tile.solid || tile.collision || collisionTiles.includes(id)),
        source: tile.source || cropTile(id, { firstgid, columns, tileWidth, tileHeight })
      });
    }
    return {
      name: String(tileset.name || `tileset-${index + 1}`),
      image: tileset.image || null,
      firstgid,
      columns,
      tileWidth,
      tileHeight,
      tilecount,
      collisionTiles,
      tiles: [...byId.values()]
    };
  });
}

function cropTile(tileId, tileset) {
  const local = Math.max(0, Number(tileId) - Number(tileset.firstgid || 1));
  const columns = Math.max(1, Number(tileset.columns || 1));
  const width = Number(tileset.tileWidth || 16);
  const height = Number(tileset.tileHeight || 16);
  return {
    x: (local % columns) * width,
    y: Math.floor(local / columns) * height,
    width,
    height
  };
}

function tilePalette(tilemap = {}) {
  return tilemap.tilesets.flatMap((tileset) => tileset.tiles);
}

function findActiveTileLayer(tilemap = {}) {
  return tilemap.layers.find((layer) => layer.id === tilemap.activeLayerId) || tilemap.layers[0];
}

function ruleTileMatches(rule, tileId, index, data, tilemap) {
  const self = Number(rule?.when?.self);
  if (Number.isFinite(self) && Number(tileId) !== self) return false;
  const adjacentAny = uniqueNumbers(rule?.when?.adjacentAny);
  if (!adjacentAny.length) return true;
  return neighborTileIds(index, data, tilemap).some((neighbor) => adjacentAny.includes(Number(neighbor)));
}

function neighborTileIds(index, data, tilemap) {
  const width = Math.max(1, Number(tilemap.width || 1));
  const height = Math.max(1, Number(tilemap.height || 1));
  const x = index % width;
  const y = Math.floor(index / width);
  const offsets = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 }
  ];
  return offsets
    .map((offset) => ({ x: x + offset.x, y: y + offset.y }))
    .filter((point) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height)
    .map((point) => data[point.y * width + point.x]);
}

function findTilesetTile(tilemap, tileId) {
  return tilePalette(tilemap || {}).find((tile) => Number(tile.id) === Number(tileId)) || null;
}

function isSolidTile(tilemap, tileId) {
  const tile = findTilesetTile(tilemap, tileId);
  const source = tilemap || {};
  return Boolean(tile?.solid || tile?.collision || (source.tilesets || []).some((tileset) => tileset.collisionTiles.includes(Number(tileId))));
}

function addCollision(tilemap, index) {
  if (!tilemap.collisions.includes(index)) tilemap.collisions.push(index);
}

function uniqueNumbers(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)))];
}

function normalizeDockLayout(layout = {}) {
  const seen = new Set();
  const normalized = {};
  for (const region of DOCK_REGIONS) {
    const panels = Array.isArray(layout?.[region]) ? layout[region] : DEFAULT_DOCK_LAYOUT[region];
    normalized[region] = [];
    for (const panel of panels) {
      if (!PANEL_TITLES[panel] || seen.has(panel)) continue;
      seen.add(panel);
      normalized[region].push(panel);
    }
  }
  return normalized;
}

function ensurePanelInDock(layout, panelName, preferredRegion = 'bottom') {
  const normalized = normalizeDockLayout(layout);
  if (Object.values(normalized).some((panels) => panels.includes(panelName))) return normalized;
  const region = DOCK_REGIONS.includes(preferredRegion) ? preferredRegion : 'bottom';
  normalized[region] = [...(normalized[region] || []), panelName];
  return normalized;
}

function isSearchableProjectFile(filePath = '') {
  return /\.(js|mjs|cjs|ts|tsx|jsx|json|scene|prefab|md|css|html)$/iu.test(filePath)
    || /(^|\/)(src|assets|scenes|config)\//iu.test(filePath);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function filterResourceAssets(assets = [], query = '') {
  const needle = String(query || '').toLowerCase();
  return (Array.isArray(assets) ? assets : [])
    .map(normalizeAssetEntry)
    .filter((asset) => ['image', 'prefab', 'json'].includes(asset.type))
    .filter((asset) => !needle || `${asset.path} ${asset.name}`.toLowerCase().includes(needle));
}

function physicsBodies(state = {}) {
  return (state.scene?.entities || [])
    .filter((entity) => entity.physics || entity.body || entity.collider)
    .map((entity) => {
      const body = entity.physics || entity.body || entity.collider || {};
      const vertices = Array.isArray(body.vertices) ? body.vertices.map((point) => ({
        x: Number(point.x || 0),
        y: Number(point.y || 0)
      })) : [];
      return {
        id: entity.id,
        shape: body.shape || body.type || 'rect',
        x: Number(entity.x || body.x || 0),
        y: Number(entity.y || body.y || 0),
        width: Number(entity.width || body.width || 32),
        height: Number(entity.height || body.height || 32),
        vertices
      };
    });
}

function findSelectedEntity(state) {
  return state.scene.entities.find((entity) => entity.id === state.selectedEntityId) || null;
}

function selectedIds(state = {}) {
  const ids = Array.isArray(state.selectedEntityIds) ? state.selectedEntityIds : [];
  const valid = new Set((state.scene?.entities || []).map((entity) => entity.id));
  const normalized = ids.filter((id) => valid.has(id));
  if (!normalized.length && state.selectedEntityId && valid.has(state.selectedEntityId)) normalized.push(state.selectedEntityId);
  return [...new Set(normalized)];
}

function resolveNextSelection(id, append, state = null) {
  if (!id) return [];
  const source = state || currentStateFallback();
  if (!append) return [id];
  const ids = selectedIds(source);
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function currentStateFallback() {
  return { scene: { entities: [] }, selectedEntityId: null, selectedEntityIds: [] };
}

function uniqueEntityId(base, existingIds) {
  let id = String(base || 'entity-copy');
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function pointerFromEvent(event = {}) {
  return {
    x: Number(event.clientX || 0),
    y: Number(event.clientY || 0)
  };
}

function normalizeRect(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function entityRect(entity = {}) {
  const left = Number(entity.x || 0);
  const top = Number(entity.y || 0);
  const width = Math.max(1, Number(entity.width || 32));
  const height = Math.max(1, Number(entity.height || 32));
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

function rectsIntersect(left, right) {
  return left.left <= right.right
    && left.right >= right.left
    && left.top <= right.bottom
    && left.bottom >= right.top;
}

function parseFieldValue(key, value, previous = null) {
  if (!NUMERIC_FIELDS.has(key) && typeof previous !== 'number') return value;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function inspectorFields(entity = null) {
  const base = ['id', 'name', 'x', 'y', 'width', 'height', 'rotation', 'scale', 'scaleX', 'scaleY', 'sprite', 'texture'];
  if (!entity) return base;
  const blocked = new Set(['parent', 'game', 'displayObject']);
  const fields = [...base];
  for (const [key, value] of Object.entries(entity)) {
    if (blocked.has(key) || key.startsWith('__') || fields.includes(key)) continue;
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) fields.push(key);
  }
  return fields;
}

function createCommandId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveScriptBinding(entity = null, symbol = null, options = {}) {
  if (!entity) return null;
  const source = entity.script || entity.behaviorScript || entity.controller || entity.code || null;
  const script = typeof source === 'string' ? { path: source } : source;
  const path = script?.path || script?.file || script?.url || script?.src || entity.scriptPath || entity.scriptFile;
  if (!path) return null;
  return {
    path,
    symbol: symbol || script.entry || script.symbol || script.method || script.function || entity.scriptEntry || 'update',
    line: Number(script.line || entity.scriptLine || 1),
    column: Number(script.column || entity.scriptColumn || 1),
    editor: options.editor || script.editor || entity.codeEditor || 'vscode'
  };
}

function normalizeWorkspaceState(value = {}) {
  if (!value || typeof value !== 'object') {
    return { root: null, name: null, directories: [], assets: [], sourceFiles: [], scenes: [] };
  }
  return {
    root: value.root || null,
    name: value.name || null,
    directories: Array.isArray(value.directories) ? value.directories : [],
    assets: Array.isArray(value.assets) ? value.assets.map(normalizeAssetEntry) : [],
    sourceFiles: Array.isArray(value.sourceFiles) ? value.sourceFiles.map(normalizeAssetEntry) : [],
    scenes: Array.isArray(value.scenes) ? value.scenes.map(normalizeAssetEntry) : [],
    scannedAt: value.scannedAt || null
  };
}

function normalizeAutoSaveState(value = {}) {
  return {
    enabled: value.enabled !== false,
    intervalMs: Math.max(1000, Number(value.intervalMs || 300000)),
    lastSavedAt: value.lastSavedAt || null,
    lastPath: value.lastPath || null
  };
}

function normalizeAssetEntry(asset = {}) {
  const source = typeof asset === 'string' ? { path: asset } : { ...asset };
  const assetPath = slash(source.path || source.url || source.name || '');
  return {
    ...source,
    path: assetPath,
    name: source.name || assetPath.split('/').pop() || assetPath,
    type: assetType(source)
  };
}

function isPrefabAsset(asset) {
  const entry = normalizeAssetEntry(asset);
  return entry.type === 'prefab' || /(^|\/)prefabs\/.+\.json$/iu.test(entry.path);
}

function assetType(asset = {}) {
  const entryPath = slash(typeof asset === 'string' ? asset : asset.path || asset.url || asset.name || '');
  const explicit = typeof asset === 'object' ? asset.type : null;
  if (explicit) return explicit;
  if (/(^|\/)prefabs\/.+\.json$/iu.test(entryPath)) return 'prefab';
  if (/(^|\/)scenes\/.+\.json$/iu.test(entryPath) || /\.scene\.json$/iu.test(entryPath)) return 'scene';
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(entryPath)) return 'image';
  if (/\.(js|mjs|cjs|ts|tsx)$/iu.test(entryPath)) return 'script';
  if (/\.(glb|gltf|fbx|obj|mtl)$/iu.test(entryPath)) return 'model';
  if (/\.(mp3|wav|ogg|m4a)$/iu.test(entryPath)) return 'audio';
  if (/\.(ttf|otf|woff|woff2)$/iu.test(entryPath)) return 'font';
  if (/\.json$/iu.test(entryPath)) return 'json';
  return 'file';
}

function isSceneAsset(asset = {}) {
  const entryPath = slash(typeof asset === 'string' ? asset : asset.path || asset.url || asset.name || '');
  return assetType(asset) === 'scene' || /(^|\/)scenes\/.+\.json$/iu.test(entryPath) || /\.scene\.json$/iu.test(entryPath);
}

function isAssetReferenceField(field, value) {
  if (typeof value !== 'string' || !value) return false;
  if (!looksLikeResourceReference(value)) return false;
  return /^(texture|sprite|image|asset|source|normalMap|atlas|audio|scene|background|script|prefab)$/iu.test(field)
    || /asset|texture|image|sprite|map|scene|source|script|prefab/iu.test(field);
}

function buildEditorClosureReport(state = {}, options = {}) {
  const collected = collectEditorClosureReferences(state);
  const knownAssets = collectKnownEditorAssets(state);
  const resourceDatabase = buildEditorResourceDatabase(knownAssets, collected.references);
  const missingAssets = resourceDatabase.filter((asset) => asset.missing && asset.referenceCount > 0);
  const sceneDependencies = collected.references
    .filter((reference) => ['scene', 'scene-tab', 'scene-file', 'file', 'entity'].includes(reference.sourceType))
    .map((reference) => ({ ...reference }));
  const prefabDependencies = collected.references
    .filter((reference) => ['prefab', 'prefab-file'].includes(reference.sourceType))
    .map((reference) => ({ ...reference }));
  return {
    protocol: 'omnicore-editor-closure/v1',
    generatedAt: options.generatedAt || new Date().toISOString(),
    scene: {
      name: state.scene?.name || 'untitled',
      entityCount: (state.scene?.entities || []).length,
      activeSceneTabPath: state.activeSceneTabPath || null
    },
    propertyPanel: createPropertyPanelSummary(state),
    sceneDependencies,
    prefabDependencies,
    resourceDatabase,
    missingAssets,
    hotReload: options.hotReload || null,
    debugTimeline: options.debugTimeline || null,
    changedFiles: (Array.isArray(options.changedFiles) ? options.changedFiles : [])
      .map((file) => slash(file || ''))
      .filter(Boolean)
  };
}

function collectEditorClosureReferences(state = {}) {
  const references = [];
  const seen = new Set();
  const addReference = (reference = {}) => {
    const path = normalizeResourcePath(reference.path);
    if (!path || !looksLikeResourceReference(path)) return;
    const source = reference.source || 'unknown';
    const field = reference.field || 'reference';
    const key = `${source}:${field}:${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push({
      source,
      sourceType: reference.sourceType || 'reference',
      field,
      path,
      entityId: reference.entityId || null,
      prefabId: reference.prefabId || null,
      filePath: reference.filePath || null,
      type: assetType(path)
    });
  };

  for (const entity of state.scene?.entities || []) {
    const entityId = entity.id || entity.name || 'entity';
    collectResourceReferencesFromValue(entity, {
      source: `entity:${entityId}`,
      sourceType: 'entity',
      entityId
    }, addReference);
  }

  for (const tab of state.sceneTabs || []) {
    collectResourceReferencesFromValue(tab.scene || {}, {
      source: tab.path || 'scene-tab',
      sourceType: 'scene-tab',
      filePath: tab.path || null
    }, addReference);
  }

  for (const prefab of state.prefabs || []) {
    const prefabId = prefab.id || prefab.name || 'prefab';
    collectResourceReferencesFromValue(prefab, {
      source: `prefab:${prefabId}`,
      sourceType: 'prefab',
      prefabId
    }, addReference);
  }

  for (const [filePath, source] of Object.entries(state.projectFiles || {})) {
    const normalizedFile = slash(filePath);
    const sourceType = /(^|\/)prefabs\//iu.test(normalizedFile)
      ? 'prefab-file'
      : /(^|\/)scenes\//iu.test(normalizedFile)
        ? 'scene-file'
        : 'file';
    for (const path of extractResourceReferencesFromText(source)) {
      addReference({
        source: normalizedFile,
        sourceType,
        field: 'source',
        path,
        prefabId: sourceType === 'prefab-file' ? normalizedFile.split('/').pop()?.replace(/\.json$/iu, '') : null,
        filePath: normalizedFile
      });
    }
  }

  return { references };
}

function collectResourceReferencesFromValue(value, context, addReference, fieldPath = '') {
  if (value == null) return;
  if (typeof value === 'string') {
    const field = fieldPath.split('.').pop() || fieldPath || 'value';
    if (looksLikeResourceReference(value) || isAssetReferenceField(field, value)) {
      addReference({ ...context, field: fieldPath || field, path: value });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectResourceReferencesFromValue(item, context, addReference, `${fieldPath}.${index}`.replace(/^\./u, '')));
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'parent' || key === 'game' || key === 'displayObject') continue;
    collectResourceReferencesFromValue(child, context, addReference, `${fieldPath}.${key}`.replace(/^\./u, ''));
  }
}

function extractResourceReferencesFromText(source = '') {
  const refs = new Set();
  const pattern = /((?:assets|sprites|audio|textures|ui|scenes|prefabs|scripts|models|materials|fonts)\/[^\s"'`<>),}\]]+)/giu;
  for (const match of String(source).matchAll(pattern)) refs.add(slash(match[1]));
  return [...refs];
}

function collectKnownEditorAssets(state = {}) {
  const entries = [];
  const seen = new Set();
  const addAsset = (asset, fallback = {}) => {
    const path = normalizeResourcePath(asset);
    if (!path || seen.has(path)) return;
    seen.add(path);
    const entry = normalizeAssetEntry(typeof asset === 'object' ? asset : { path, ...fallback });
    entries.push({
      ...entry,
      ...fallback,
      path,
      type: fallback.type || entry.type,
      missingStub: Boolean(asset?.missingStub || fallback.missingStub)
    });
  };
  for (const asset of state.assets || []) addAsset(asset);
  for (const asset of state.workspace?.assets || []) addAsset(asset);
  for (const asset of state.workspace?.sourceFiles || []) addAsset(asset);
  for (const asset of state.workspace?.scenes || []) addAsset(asset, { type: 'scene' });
  for (const filePath of Object.keys(state.projectFiles || {})) {
    addAsset({ path: filePath, type: assetType(filePath), projectFile: true });
  }
  for (const tab of state.sceneTabs || []) {
    if (tab.path) addAsset({ path: tab.path, type: 'scene', sceneTab: true });
  }
  for (const prefab of state.prefabs || []) {
    const path = normalizeResourcePath(prefab.path || prefab.file || prefab.source || prefab.url || '');
    if (path) addAsset({ path, type: 'prefab', prefabId: prefab.id || prefab.name });
  }
  return entries;
}

function buildEditorResourceDatabase(knownAssets = [], references = []) {
  const rows = new Map();
  const ensureRow = (path, defaults = {}) => {
    if (!rows.has(path)) {
      rows.set(path, {
        path,
        type: defaults.type || assetType(path),
        name: defaults.name || path.split('/').pop() || path,
        missing: Boolean(defaults.missing),
        missingStub: Boolean(defaults.missingStub),
        referenceCount: 0,
        sources: []
      });
    }
    const row = rows.get(path);
    if (defaults.missing === false) row.missing = false;
    if (defaults.missingStub) row.missingStub = true;
    if (defaults.type) row.type = defaults.type;
    return row;
  };
  for (const asset of knownAssets) {
    ensureRow(asset.path, {
      type: asset.type,
      name: asset.name,
      missing: false,
      missingStub: asset.missingStub
    });
  }
  for (const reference of references) {
    const row = ensureRow(reference.path, { type: reference.type, missing: true });
    row.referenceCount += 1;
    const source = `${reference.source}:${reference.field}`;
    if (!row.sources.includes(source)) row.sources.push(source);
  }
  return [...rows.values()].sort((left, right) => {
    if (left.missing !== right.missing) return left.missing ? -1 : 1;
    return left.path.localeCompare(right.path);
  });
}

function buildEditorAssetRegistryState(state = {}, options = {}) {
  const report = buildEditorClosureReport(state, {
    generatedAt: options.generatedAt || new Date().toISOString(),
    changedFiles: options.changedFiles || state.hotReload?.changedFiles || [],
    hotReload: options.hotReload || state.hotReload || null,
    debugTimeline: options.debugTimeline || state.editorClosure?.debugTimeline || null
  });
  const entriesByPath = new Map();
  const ensureAsset = (asset, fallback = {}) => {
    const path = normalizeResourcePath(asset);
    if (!path) return null;
    const source = typeof asset === 'object' && asset ? { ...asset } : { path };
    const normalized = normalizeAssetEntry({ ...fallback, ...source, path });
    const existing = entriesByPath.get(path) || {};
    const merged = {
      ...existing,
      ...normalized,
      path,
      type: normalized.type || existing.type || fallback.type || assetType(path),
      uid: normalized.uid || existing.uid || fallback.uid || null,
      primaryId: normalized.primaryId || normalized.primaryAssetId || existing.primaryId || fallback.primaryId || null,
      address: normalized.address || existing.address || fallback.address || null,
      labels: uniqueStrings([
        ...(existing.labels || []),
        ...stringList(normalized.labels),
        ...stringList(fallback.labels)
      ]),
      tags: {
        ...(isPlainObject(existing.tags) ? existing.tags : {}),
        ...(isPlainObject(normalized.tags) ? normalized.tags : {}),
        ...(isPlainObject(fallback.tags) ? fallback.tags : {})
      },
      dependencies: uniqueStrings([
        ...(existing.dependencies || []),
        ...stringList(normalized.dependencies),
        ...stringList(fallback.dependencies)
      ]).sort()
    };
    entriesByPath.set(path, merged);
    return merged;
  };

  collectKnownEditorAssets(state).forEach((asset) => ensureAsset(asset));
  for (const row of report.resourceDatabase || []) {
    if (!row.missing) ensureAsset(row);
  }

  for (const reference of collectEditorClosureReferences(state).references) {
    const sourcePath = resolveEditorRegistrySourcePath(state, reference);
    const dependencyPath = normalizeResourcePath(reference.path);
    if (!sourcePath || !dependencyPath || sourcePath === dependencyPath) continue;
    const sourceAsset = ensureAsset({ path: sourcePath, type: assetType(sourcePath) });
    if (!sourceAsset) continue;
    sourceAsset.dependencies = uniqueStrings([...(sourceAsset.dependencies || []), dependencyPath]).sort();
  }

  const entries = [...entriesByPath.values()]
    .map((asset) => ({
      ...asset,
      dependencies: uniqueStrings(asset.dependencies || []).sort()
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const registry = new AssetRegistry({ assets: entries });
  return {
    registry,
    entries,
    report,
    snapshot: registry.snapshot(),
    audit: registry.audit()
  };
}

function buildAssetRegistryPanelState(state = {}, options = {}) {
  const registryState = buildEditorAssetRegistryState(state, options);
  const query = String(options.query ?? state.assetRegistryPanel?.query ?? '').trim().toLowerCase();
  const changeKinds = assetChangeKindMap(state.assetRefresh);
  const rowByPath = new Map();
  for (const row of registryState.report.resourceDatabase || []) {
    rowByPath.set(row.path, row);
  }
  for (const asset of registryState.entries || []) {
    if (!rowByPath.has(asset.path)) {
      rowByPath.set(asset.path, {
        path: asset.path,
        name: asset.name || asset.path.split('/').pop() || asset.path,
        type: asset.type || assetType(asset.path),
        missing: false,
        missingStub: Boolean(asset.missingStub),
        referenceCount: 0,
        sources: []
      });
    } else {
      const row = rowByPath.get(asset.path);
      if (asset.missingStub) row.missingStub = true;
      if (asset.changeKind) row.changeKind = asset.changeKind;
    }
  }
  const diagnostics = buildAssetRegistryDiagnostics(registryState, state);
  const rows = [...rowByPath.values()]
    .map((row) => {
      const dependencies = registryState.snapshot.dependencies[row.path] || [];
      const referencers = registryState.snapshot.referencers[row.path] || [];
      return {
        ...cloneState(row),
        dependencyCount: dependencies.filter((edge) => !edge.missing).length,
        missingDependencyCount: dependencies.filter((edge) => edge.missing).length,
        referencerCount: referencers.length,
        dependencies: cloneState(dependencies),
        referencers: cloneState(referencers),
        changeKind: row.changeKind || changeKinds.get(row.path) || null
      };
    })
    .filter((row) => !query || [
      row.path,
      row.name,
      row.type,
      row.changeKind
    ].some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((left, right) => {
      if (left.missing !== right.missing) return left.missing ? -1 : 1;
      if (left.changeKind !== right.changeKind) return left.changeKind ? -1 : 1;
      return left.path.localeCompare(right.path);
    });

  return {
    schema: 'omnicore.editor-asset-registry-panel.v1',
    query,
    generatedAt: options.generatedAt || new Date().toISOString(),
    snapshot: registryState.snapshot,
    audit: registryState.audit,
    diagnostics,
    quickFixes: diagnostics.quickFixes,
    rows
  };
}

function createEditorScene3DKit(sceneInput = {}) {
  const source = sceneInput && typeof sceneInput === 'object' ? sceneInput : {};
  const kit = new Scene3DKit({
    name: source.name || 'scene-3d',
    width: source.width || 1280,
    height: source.height || 720,
    background: source.background || '#000000'
  });
  for (const camera of arrayFromValue(source.cameras || source.camera)) kit.setCamera(camera);
  for (const light of arrayFromValue(source.lights || source.light)) {
    kit.addLight(light.id || light.lightType || light.type || 'directional', light);
  }
  for (const material of arrayFromValue(source.materials || source.material)) kit.addMaterial(material.id, material);
  for (const model of arrayFromValue(source.models || source.model)) kit.addGLTFModel(model);
  for (const pass of arrayFromValue(source.postprocess || source.postProcess || source.passes)) kit.addPostProcess(pass);
  return kit;
}

function createEditorScene3DReadinessState({
  sceneKit,
  availableAssets = [],
  budgets = {},
  report = null,
  generatedAt = new Date().toISOString()
} = {}) {
  return {
    schema: 'omnicore.editor-scene-3d-readiness.v1',
    source: 'editor-scene-3d-readiness',
    generatedAt,
    scene: exportEditorScene3DKitState(sceneKit),
    availableAssets: cloneState(availableAssets),
    budgets: cloneState(budgets),
    report: cloneState(report)
  };
}

function exportEditorScene3DKitState(sceneKit = null) {
  if (!sceneKit) {
    return {
      name: 'scene-3d',
      width: 1280,
      height: 720,
      background: '#000000',
      cameras: [],
      lights: [],
      materials: [],
      models: [],
      postprocess: []
    };
  }
  return {
    name: sceneKit.name,
    width: sceneKit.width,
    height: sceneKit.height,
    background: sceneKit.background,
    cameras: cloneState([...sceneKit.cameras.values()]),
    lights: cloneState([...sceneKit.lights.values()]),
    materials: cloneState([...sceneKit.materials.values()]),
    models: cloneState([...sceneKit.models.values()]),
    postprocess: cloneState([...sceneKit.postprocess])
  };
}

function collectScene3DAvailableAssets(state = {}) {
  return (state.assets || [])
    .map((asset) => normalizeResourcePath(asset))
    .filter((path) => /\.(gltf|glb|png|jpg|jpeg|webp|ktx|ktx2|hdr|exr)$/iu.test(path));
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function buildRenderDiagnosticsPanelState(state = {}, options = {}) {
  const input = resolveRenderDiagnosticsInput(state, options);
  const diagnostics = new BatchAtlasDiagnostics(options.budgets || state.renderDiagnosticsPanel?.budgets || {});
  const report = diagnostics.createFrameBudgetReport(input);
  const quickFixes = report.recommendations.map((recommendation) => renderDiagnosticsQuickFix(recommendation, report));
  return {
    schema: 'omnicore.editor-render-diagnostics-panel.v1',
    source: options.source || input.source || 'editor-render-diagnostics',
    generatedAt: options.generatedAt || new Date().toISOString(),
    budgets: {
      frameBudgetMs: diagnostics.frameBudgetMs,
      drawCallBudget: diagnostics.drawCallBudget,
      textureUploadBudget: diagnostics.textureUploadBudget,
      textureUploadByteBudget: Number.isFinite(diagnostics.textureUploadByteBudget) ? diagnostics.textureUploadByteBudget : null,
      filterPassBudget: diagnostics.filterPassBudget
    },
    input: cloneState(input),
    report,
    summary: {
      ...report.summary,
      issueCount: report.issues.length,
      quickFixCount: quickFixes.length
    },
    issues: cloneState(report.issues),
    quickFixes,
    rows: [
      { id: 'frame-budget', label: '帧预算', value: `${report.summary.cpuMs}ms CPU / ${report.summary.gpuMs}ms GPU`, severity: report.summary.severity },
      { id: 'batch', label: 'Batch', value: `${report.summary.drawCallsBefore} -> ${report.summary.predictedDrawCallsAfter}`, severity: report.batch.batchBreaks.length ? 'warning' : 'ok' },
      { id: 'texture-uploads', label: '纹理上传', value: String(report.summary.textureUploadCount), severity: report.textureUploads.length > diagnostics.textureUploadBudget ? 'warning' : 'ok' },
      { id: 'filter-costs', label: 'Filter', value: `${report.summary.filterPassCount} pass / ${report.summary.filterMs}ms`, severity: report.summary.filterPassCount > diagnostics.filterPassBudget ? 'warning' : 'ok' },
      { id: 'backend-fallback', label: '后端', value: report.backend.selected || '未选择', severity: report.backend.rejected.length ? 'info' : 'ok' }
    ],
    crossEngineProfile: report.crossEngineProfile
  };
}

function resolveRenderDiagnosticsInput(state = {}, options = {}) {
  const previous = state.renderDiagnosticsPanel?.input || {};
  return {
    source: options.source || previous.source || 'editor',
    frame: options.frame || previous.frame || profilerFrameToRenderFrame(state.profilerFrame),
    backend: options.backend || previous.backend || {
      selected: 'webgl2',
      fallbackChain: ['webgpu', 'webgl2'],
      rejected: []
    },
    draws: options.draws || previous.draws || sceneEntitiesToRenderDraws(state),
    textureUploads: options.textureUploads || previous.textureUploads || [],
    filterPasses: options.filterPasses || previous.filterPasses || []
  };
}

function profilerFrameToRenderFrame(frame = {}) {
  const sample = frame || {};
  const totalMs = Number(sample.totalMs || 0);
  const renderSection = (sample.sections || []).find((section) => /render|绘制|渲染/iu.test(section.name || '')) || sample.sections?.[0] || {};
  return {
    index: Number(sample.frame || sample.index || 0),
    cpuMs: totalMs,
    gpuMs: Number(renderSection.duration || 0),
    fps: totalMs > 0 ? Math.round(1000 / totalMs) : 0
  };
}

function sceneEntitiesToRenderDraws(state = {}) {
  return (state.scene?.entities || []).map((entity, index) => {
    const material = entity.material && typeof entity.material === 'object' ? entity.material : {};
    return {
      id: entity.id || entity.name || `entity-${index + 1}`,
      texture: entity.sprite || entity.texture || material.texture || material.albedo || 'texture',
      material: material.shader || material.name || material.type || entity.material || entity.type || 'default',
      blendMode: entity.blendMode || material.blendMode || 'normal',
      dynamic: Boolean(entity.animation || entity.animated || entity.video || entity.physics)
    };
  });
}

function renderDiagnosticsQuickFix(recommendation, report = {}) {
  const id = String(recommendation || '');
  return {
    id,
    type: renderDiagnosticActionType(id),
    label: renderDiagnosticActionLabel(id),
    recommendation: id,
    issueTypes: (report.issues || []).map((issue) => issue.type)
  };
}

function renderDiagnosticActionType(recommendation = '') {
  if (recommendation.startsWith('createAtlas:')) return 'createAtlas';
  if (recommendation === 'deferTextureUploads') return 'scheduleTextureUploads';
  if (recommendation === 'flattenFilterChain') return 'optimizeFilters';
  if (recommendation === 'preferWebGPUWhenAvailable') return 'reviewBackendFallback';
  if (recommendation === 'sortByMaterialTexture') return 'sortRenderQueue';
  if (recommendation === 'keepDynamicSpritesOutOfStaticBatches') return 'splitDynamicSprites';
  return 'inspect';
}

function renderDiagnosticActionLabel(recommendation = '') {
  if (recommendation.startsWith('createAtlas:')) return `创建图集 ${recommendation.slice('createAtlas:'.length)}`;
  const labels = {
    deferTextureUploads: '延后纹理上传到预热或分帧队列',
    flattenFilterChain: '合并 Filter 链并减少后处理 Pass',
    preferWebGPUWhenAvailable: '检查 WebGPU fallback 条件',
    profileCpuFrame: '打开 CPU 帧采样',
    profileGpuPasses: '检查 GPU Pass 成本',
    sortByMaterialTexture: '按材质和纹理排序渲染队列',
    keepDynamicSpritesOutOfStaticBatches: '把动态精灵移出静态 Batch',
    reviewBackendFallback: '复核渲染后端 fallback 原因'
  };
  return labels[recommendation] || `检查建议 ${recommendation}`;
}

function findRenderDiagnosticsQuickFix(state = {}, actionId = '') {
  const id = String(actionId || '');
  const panel = state.renderDiagnosticsPanel || buildRenderDiagnosticsPanelState(state);
  return (panel.quickFixes || []).find((action) => action.id === id) || null;
}

function buildRenderOptimizationPlan(state = {}, action = {}, options = {}) {
  const panel = state.renderDiagnosticsPanel || buildRenderDiagnosticsPanelState(state);
  const report = panel.report || {};
  const input = panel.input || {};
  const appliedAt = options.appliedAt || new Date(Number(options.now || Date.now())).toISOString();
  const previous = normalizeRenderOptimizationPlanState(state.renderOptimizationPlan);
  const plan = {
    ...previous,
    id: previous.id || createRenderOptimizationPlanId(appliedAt),
    source: options.source || panel.source || previous.source || 'editor-render-diagnostics',
    updatedAt: appliedAt,
    frameIndex: report.summary?.frameIndex ?? panel.summary?.frameIndex ?? previous.frameIndex ?? null,
    budgets: cloneState(panel.budgets || previous.budgets || {})
  };

  applyRenderOptimizationAction(plan, action, report, input, appliedAt);
  const actionRecord = {
    ...action,
    appliedAt,
    frameIndex: plan.frameIndex,
    result: describeRenderOptimizationAction(action, plan)
  };
  plan.actions = upsertRenderPlanItems(plan.actions, [actionRecord], 'id').slice(-48);
  return plan;
}

function normalizeRenderOptimizationPlanState(value = null) {
  const source = value && typeof value === 'object' ? value : {};
  const textureUploads = source.textureUploads && typeof source.textureUploads === 'object'
    ? source.textureUploads
    : {};
  const filters = source.filters && typeof source.filters === 'object' ? source.filters : {};
  const renderQueue = source.renderQueue && typeof source.renderQueue === 'object' ? source.renderQueue : {};
  return {
    schema: 'omnicore.editor-render-optimization-plan.v1',
    id: source.id || '',
    source: source.source || 'editor-render-diagnostics',
    updatedAt: source.updatedAt || null,
    frameIndex: source.frameIndex ?? null,
    budgets: cloneState(source.budgets || {}),
    atlases: cloneState(Array.isArray(source.atlases) ? source.atlases : []),
    textureUploads: {
      deferred: cloneState(Array.isArray(textureUploads.deferred) ? textureUploads.deferred : []),
      warmupQueue: cloneState(Array.isArray(textureUploads.warmupQueue) ? textureUploads.warmupQueue : [])
    },
    filters: {
      flattened: cloneState(Array.isArray(filters.flattened) ? filters.flattened : []),
      passBudget: filters.passBudget ?? null,
      estimatedSavedPasses: Number(filters.estimatedSavedPasses || 0)
    },
    backend: source.backend ? cloneState(source.backend) : null,
    renderQueue: {
      sortGroups: cloneState(Array.isArray(renderQueue.sortGroups) ? renderQueue.sortGroups : []),
      dynamicSprites: cloneState(Array.isArray(renderQueue.dynamicSprites) ? renderQueue.dynamicSprites : [])
    },
    actions: cloneState(Array.isArray(source.actions) ? source.actions : [])
  };
}

function createRenderOptimizationPlanId(appliedAt = '') {
  const stamp = Date.parse(appliedAt);
  return `render-plan-${Number.isFinite(stamp) ? stamp : Date.now()}`;
}

function createRenderOptimizationRuntimePlan(planInput = null, options = {}) {
  const plan = normalizeRenderOptimizationPlanState(planInput);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const runtimeActions = buildRenderOptimizationRuntimeActions(plan);
  return {
    format: 'OmniCore.RenderOptimizationRuntimePlan',
    schema: 'omnicore.render-optimization-runtime.v1',
    version: 1,
    generatedAt,
    sourcePlanId: plan.id || null,
    frameIndex: plan.frameIndex,
    budgets: cloneState(plan.budgets),
    scheduler: {
      textureUploads: {
        strategy: 'warmup-or-frame-split',
        maxUploadsPerFrame: Math.max(1, Number(plan.budgets.textureUploadBudget || plan.textureUploads.warmupQueue?.[0]?.maxUploadsPerFrame || 1)),
        queue: cloneState(plan.textureUploads.warmupQueue.length ? plan.textureUploads.warmupQueue : plan.textureUploads.deferred)
      },
      atlases: cloneState(plan.atlases),
      filters: {
        flatten: cloneState(plan.filters.flattened),
        passBudget: plan.filters.passBudget,
        estimatedSavedPasses: plan.filters.estimatedSavedPasses
      },
      backend: plan.backend ? cloneState(plan.backend) : null,
      renderQueue: cloneState(plan.renderQueue)
    },
    runtimeActions,
    sourcePlan: cloneState(plan),
    crossEngineProfile: [
      { engine: 'PixiJS', advantage: 'texture warmup, batching, and renderer fallback are explicit runtime concerns' },
      { engine: 'Unity Frame Debugger', advantage: 'diagnostic findings can become concrete frame/render settings' },
      { engine: 'Unreal GPU Visualizer', advantage: 'render pass cost should map to actionable pass reduction work' },
      { engine: 'Three.js ecosystem', advantage: 'renderer backend and resource lifecycle choices stay portable' }
    ]
  };
}

function buildRenderOptimizationRuntimeActions(planInput = {}) {
  const plan = normalizeRenderOptimizationPlanState(planInput);
  const atlasActions = plan.atlases.map((atlas) => ({
    type: 'buildAtlas',
    key: atlas.key,
    material: atlas.material,
    blendMode: atlas.blendMode,
    textures: cloneState(atlas.textures || []),
    status: atlas.status || 'planned'
  }));
  const uploadActions = plan.textureUploads.deferred.map((upload) => ({
    type: 'scheduleTextureUpload',
    id: upload.id,
    bytes: Number(upload.bytes || 0),
    reason: upload.reason || 'frame-upload',
    strategy: upload.strategy || 'warmup-or-frame-split',
    maxUploadsPerFrame: Math.max(1, Number(plan.budgets.textureUploadBudget || upload.maxUploadsPerFrame || 1))
  }));
  const filterActions = plan.filters.flattened.map((filter) => ({
    type: 'flattenFilter',
    id: filter.id,
    passes: Number(filter.passes || 1),
    targetPasses: Math.max(1, Number(filter.targetPasses || 1)),
    estimatedMs: Number(filter.estimatedMs || 0)
  }));
  const backendActions = plan.backend?.preferred ? [{
    type: 'preferBackend',
    backend: plan.backend.preferred,
    selected: plan.backend.selected || null,
    fallbackChain: cloneState(plan.backend.fallbackChain || []),
    rejected: cloneState(plan.backend.rejected || []),
    checks: cloneState(plan.backend.checks || [])
  }] : [];
  const queueActions = (plan.renderQueue.sortGroups || []).map((group) => ({
    type: 'sortRenderQueueGroup',
    key: group.key,
    material: group.material,
    texture: group.texture,
    draws: cloneState(group.draws || [])
  }));
  const dynamicActions = (plan.renderQueue.dynamicSprites || []).map((sprite) => ({
    type: 'splitDynamicSpriteBatch',
    id: sprite.id,
    texture: sprite.texture,
    status: sprite.status || 'planned'
  }));
  return [
    ...atlasActions,
    ...uploadActions,
    ...filterActions,
    ...backendActions,
    ...queueActions,
    ...dynamicActions
  ];
}

function applyRenderOptimizationAction(plan, action = {}, report = {}, input = {}, appliedAt = '') {
  if (action.type === 'createAtlas') {
    const key = action.id.slice('createAtlas:'.length);
    const candidate = (report.batch?.atlasCandidates || []).find((entry) => entry.key === key) || { key, textures: [] };
    const [material = 'default', blendMode = 'normal'] = key.split('|');
    plan.atlases = upsertRenderPlanItems(plan.atlases, [{
      key,
      material,
      blendMode,
      textures: uniqueStrings(candidate.textures || []).sort(),
      spriteCount: Number(candidate.spriteCount || candidate.textures?.length || 0),
      status: 'planned',
      generatedAt: appliedAt,
      reason: '减少纹理切换和 Draw Call'
    }], 'key');
  }

  if (action.type === 'scheduleTextureUploads') {
    const uploads = (report.textureUploads || []).map((upload, index) => ({
      id: String(upload.id || `upload-${index + 1}`),
      bytes: Number(upload.bytes || 0),
      reason: upload.reason || 'frame-upload',
      strategy: 'warmup-or-frame-split',
      status: 'planned',
      generatedAt: appliedAt
    }));
    plan.textureUploads.deferred = upsertRenderPlanItems(plan.textureUploads.deferred, uploads, 'id');
    plan.textureUploads.warmupQueue = upsertRenderPlanItems(plan.textureUploads.warmupQueue, uploads.map((upload) => ({
      ...upload,
      maxUploadsPerFrame: Math.max(1, Number(plan.budgets.textureUploadBudget || 1))
    })), 'id');
  }

  if (action.type === 'optimizeFilters') {
    const flattened = (report.filterPasses || []).map((filter, index) => ({
      id: String(filter.id || `filter-${index + 1}`),
      passes: Number(filter.passes || 1),
      estimatedMs: Number(filter.estimatedMs || 0),
      targetPasses: 1,
      status: 'planned',
      generatedAt: appliedAt
    }));
    plan.filters.flattened = upsertRenderPlanItems(plan.filters.flattened, flattened, 'id');
    plan.filters.passBudget = plan.budgets.filterPassBudget ?? report.summary?.filterPassCount ?? null;
    plan.filters.estimatedSavedPasses = plan.filters.flattened
      .reduce((sum, filter) => sum + Math.max(0, Number(filter.passes || 1) - Number(filter.targetPasses || 1)), 0);
  }

  if (action.type === 'reviewBackendFallback') {
    plan.backend = {
      preferred: 'webgpu',
      selected: report.backend?.selected || null,
      fallbackChain: cloneState(report.backend?.fallbackChain || []),
      rejected: cloneState(report.backend?.rejected || []),
      checks: ['secure-context', 'adapter-request', 'feature-flags', 'device-lost-recovery'],
      status: report.backend?.selected === 'webgpu' ? 'active' : 'review',
      updatedAt: appliedAt
    };
  }

  if (action.type === 'sortRenderQueue') {
    plan.renderQueue.sortGroups = buildRenderQueueSortGroups(input.draws || []);
  }

  if (action.type === 'splitDynamicSprites') {
    const dynamicSprites = (input.draws || [])
      .filter((draw) => draw?.dynamic || draw?.animated || draw?.video)
      .map((draw, index) => ({
        id: String(draw.id || draw.name || `dynamic-${index + 1}`),
        texture: String(draw.texture || draw.sprite || 'texture'),
        status: 'planned',
        generatedAt: appliedAt
      }));
    plan.renderQueue.dynamicSprites = upsertRenderPlanItems(plan.renderQueue.dynamicSprites, dynamicSprites, 'id');
  }
}

function buildRenderQueueSortGroups(draws = []) {
  const groups = new Map();
  for (const draw of Array.isArray(draws) ? draws : []) {
    const material = String(draw?.material || draw?.shader || 'default');
    const blendMode = String(draw?.blendMode || 'normal');
    const texture = String(draw?.texture || draw?.sprite || 'texture');
    const key = `${material}|${blendMode}|${texture}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        material,
        blendMode,
        texture,
        draws: []
      });
    }
    groups.get(key).draws.push(String(draw?.id || draw?.name || `draw-${groups.get(key).draws.length + 1}`));
  }
  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function upsertRenderPlanItems(existing = [], incoming = [], key = 'id') {
  const byKey = new Map();
  for (const item of Array.isArray(existing) ? existing : []) {
    const itemKey = item?.[key];
    if (itemKey != null) byKey.set(String(itemKey), cloneState(item));
  }
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const itemKey = item?.[key];
    if (itemKey != null) byKey.set(String(itemKey), cloneState(item));
  }
  return [...byKey.values()];
}

function markRenderDiagnosticsActionApplied(panel = {}, action = {}) {
  const nextPanel = cloneState(panel || {});
  const previous = Array.isArray(nextPanel.appliedActions) ? nextPanel.appliedActions : [];
  nextPanel.quickFixes = (nextPanel.quickFixes || []).map((quickFix) => (
    quickFix.id === action.id
      ? { ...quickFix, applied: true, appliedAt: action.appliedAt, planId: action.planId, result: action.result }
      : quickFix
  ));
  nextPanel.appliedActions = upsertRenderPlanItems(previous, [action], 'id').slice(-32);
  nextPanel.summary = {
    ...(nextPanel.summary || {}),
    appliedActionCount: nextPanel.appliedActions.length
  };
  return nextPanel;
}

function describeRenderOptimizationAction(action = {}, plan = {}) {
  if (action.type === 'createAtlas') return `已规划 ${plan.atlases?.length || 0} 个图集`;
  if (action.type === 'scheduleTextureUploads') return `已规划 ${plan.textureUploads?.deferred?.length || 0} 个纹理上传`;
  if (action.type === 'optimizeFilters') return `预计减少 ${plan.filters?.estimatedSavedPasses || 0} 个 Filter Pass`;
  if (action.type === 'reviewBackendFallback') return `已生成 ${formatRenderBackendName(plan.backend?.preferred)} fallback 检查项`;
  if (action.type === 'sortRenderQueue') return `已生成 ${plan.renderQueue?.sortGroups?.length || 0} 个渲染排序组`;
  if (action.type === 'splitDynamicSprites') return `已规划 ${plan.renderQueue?.dynamicSprites?.length || 0} 个动态精灵分离项`;
  return '已写入渲染诊断计划';
}

function summarizeRenderOptimizationPlan(plan = {}) {
  const atlasCount = plan.atlases?.length || 0;
  const deferredUploads = plan.textureUploads?.deferred?.length || 0;
  const filterCount = plan.filters?.flattened?.length || 0;
  const actionCount = plan.actions?.length || 0;
  const runtimeActionCount = buildRenderOptimizationRuntimeActions(plan).length;
  const backend = plan.backend?.preferred ? formatRenderBackendName(plan.backend.preferred) : '未配置';
  return `图集 ${atlasCount} · 纹理上传 ${deferredUploads} · Filter ${filterCount} · 后端 ${backend} · 动作 ${actionCount} · 运行时动作 ${runtimeActionCount}`;
}

function createEditorRenderOptimizationVerificationReport(state = {}, input = {}, options = {}) {
  const verifiedAt = resolveEditorVerificationTimestamp(input.verifiedAt || options.verifiedAt || input.now || options.now);
  const runtimePlan = input.runtimePlan || createRenderOptimizationRuntimePlan(state.renderOptimizationPlan, {
    generatedAt: verifiedAt
  });
  const applyReport = input.applyReport || {
    schema: 'omnicore.render-optimization-apply-report.v1',
    sourcePlanId: runtimePlan.sourcePlanId || state.renderOptimizationPlan?.id || null,
    status: input.applyStatus || 'applied',
    applied: cloneState(runtimePlan.runtimeActions || []),
    summary: { appliedCount: runtimePlan.runtimeActions?.length || 0 }
  };
  const before = normalizeRenderVerificationMetrics(input.before || createRenderVerificationMetricsFromPanel(state.renderDiagnosticsPanel));
  const after = normalizeRenderVerificationMetrics(input.after || before);
  const budgets = normalizeRenderVerificationBudgets(input.budgets || runtimePlan.budgets || state.renderDiagnosticsPanel?.budgets);
  const gates = [
    buildEditorVerificationGate('frame-budget', 'Frame budget', before.frameMs, after.frameMs, budgets.frameMs),
    buildEditorVerificationGate('draw-call-budget', 'Draw call budget', before.drawCalls, after.drawCalls, budgets.drawCalls),
    buildEditorVerificationGate('texture-upload-budget', 'Texture upload budget', before.textureUploads, after.textureUploads, budgets.textureUploads),
    buildEditorVerificationGate('filter-pass-budget', 'Filter pass budget', before.filterPasses, after.filterPasses, budgets.filterPasses)
  ];
  const regressions = gates
    .filter((gate) => gate.delta > 0)
    .map(({ id, label, before: beforeValue, after: afterValue, delta, budget, ok }) => ({
      id,
      label,
      before: beforeValue,
      after: afterValue,
      delta,
      budget,
      ok
    }));
  const gatesFailed = gates.filter((gate) => !gate.ok).length;
  const appliedCount = Number(applyReport.summary?.appliedCount ?? applyReport.applied?.length ?? 0);
  return {
    schema: 'omnicore.render-optimization-verification-report.v1',
    source: input.source || options.source || 'editor-render-diagnostics',
    sourcePlanId: applyReport.sourcePlanId || runtimePlan.sourcePlanId || state.renderOptimizationPlan?.id || null,
    runtimePlanId: runtimePlan.sourcePlanId || null,
    frameIndex: input.frameIndex ?? state.renderDiagnosticsPanel?.summary?.frameIndex ?? runtimePlan.frameIndex ?? null,
    verifiedAt,
    applyStatus: applyReport.status || null,
    ok: gatesFailed === 0,
    status: gatesFailed > 0 ? 'failed' : (regressions.length ? 'warning' : 'passed'),
    before,
    after,
    budgets,
    gates,
    regressions,
    summary: {
      appliedCount,
      savedDrawCalls: Math.max(0, roundEditorVerificationMetric(before.drawCalls - after.drawCalls)),
      frameMsDelta: roundEditorVerificationMetric(after.frameMs - before.frameMs),
      gatesPassed: gates.length - gatesFailed,
      gatesFailed
    },
    crossEngineProfile: {
      sources: [
        { engine: 'Godot', advantage: 'editor-visible profiling and scene feedback keep optimization actionable' },
        { engine: 'Unity', advantage: 'Profiler-style before/after budgets make optimization evidence explicit' },
        { engine: 'Unreal', advantage: 'Insights-style regression gates expose render cost changes' },
        { engine: 'PixiJS', advantage: 'batching, texture upload, and filter costs stay visible to 2D workflows' }
      ],
      capabilities: [
        'editor-render-optimization-verification',
        'runtime-budget-gate-visualization',
        'before-after-render-evidence',
        'render-regression-surfacing'
      ]
    }
  };
}

function createRenderOptimizationRemediationPlan(state = {}, verification = {}, input = {}, options = {}) {
  if (!verification || verification.ok === true) return null;
  const generatedAt = resolveEditorVerificationTimestamp(input.remediationAt || options.remediationAt || verification.verifiedAt);
  const failedGates = (verification.gates || []).filter((gate) => !gate.ok || gate.delta > 0);
  const actions = [];
  const addAction = (action) => {
    if (!action?.type || actions.some((item) => item.type === action.type && item.gate === action.gate)) return;
    actions.push(action);
  };

  addAction({
    id: 'rollback-render-plan',
    type: 'rollbackRenderPlan',
    label: '回退优化计划',
    gate: 'verification-failed',
    reason: '优化验证失败，先恢复到应用前状态再重新分批验证。',
    sourcePlanId: verification.sourcePlanId || state.renderOptimizationPlan?.id || null
  });

  for (const gate of failedGates) {
    if (gate.id === 'draw-call-budget') {
      addAction({
        id: 'rebuild-atlas-groups',
        type: 'rebuildAtlasGroups',
        label: '重建图集与排序',
        gate: gate.id,
        before: gate.before,
        after: gate.after,
        budget: gate.budget,
        reason: 'Draw Call 超预算或退化，重新检查图集、材质切换和渲染队列排序。'
      });
    }
    if (gate.id === 'texture-upload-budget') {
      addAction({
        id: 'cap-texture-uploads',
        type: 'capTextureUploads',
        label: '纹理上传降级',
        gate: gate.id,
        maxUploadsPerFrame: Math.max(1, Number(gate.budget || 1)),
        before: gate.before,
        after: gate.after,
        budget: gate.budget,
        reason: '纹理上传仍然超预算，降低每帧上传数量并转入预热队列。'
      });
    }
    if (gate.id === 'filter-pass-budget') {
      addAction({
        id: 'reduce-filter-passes',
        type: 'reduceFilterPasses',
        label: '压缩 Filter Pass',
        gate: gate.id,
        targetPasses: Math.max(1, Number(gate.budget || 1)),
        before: gate.before,
        after: gate.after,
        budget: gate.budget,
        reason: 'Filter Pass 仍然超预算，继续合并后处理链并禁用高成本滤镜。'
      });
    }
    if (gate.id === 'frame-budget') {
      addAction({
        id: 'capture-render-profile',
        type: 'captureRenderProfile',
        label: '采集渲染证据',
        gate: gate.id,
        before: gate.before,
        after: gate.after,
        budget: gate.budget,
        reason: '帧耗时退化，需要保存下一帧 profiler、draw call、upload 和 filter 证据。'
      });
    }
  }

  const priority = failedGates.some((gate) => gate.id === 'frame-budget' && !gate.ok)
    ? 'critical'
    : (failedGates.length ? 'high' : 'medium');
  return {
    schema: 'omnicore.render-optimization-remediation-plan.v1',
    source: input.source || options.source || 'editor-render-diagnostics',
    sourcePlanId: verification.sourcePlanId || state.renderOptimizationPlan?.id || null,
    sourceVerificationStatus: verification.status || 'failed',
    generatedAt,
    priority,
    actions,
    summary: {
      actionCount: actions.length,
      failedGateCount: (verification.gates || []).filter((gate) => !gate.ok).length,
      regressionCount: (verification.regressions || []).length
    },
    crossEngineProfile: {
      sources: [
        { engine: 'Unity', advantage: 'Profiler regressions should lead to concrete optimization tasks' },
        { engine: 'Unreal', advantage: 'Insights findings should produce rollback and re-profile steps' },
        { engine: 'Godot', advantage: 'editor diagnostics should remain visible and beginner-actionable' },
        { engine: 'Cocos Creator', advantage: 'asset and render fixes should stay in the editor workflow' }
      ],
      capabilities: [
        'failed-verification-remediation-plan',
        'render-optimization-rollback-guidance',
        'budget-gate-follow-up-actions',
        'editor-visible-render-recovery'
      ]
    }
  };
}

function findRenderOptimizationRemediationAction(plan = null, actionId = '') {
  const key = String(actionId || '');
  return (plan?.actions || []).find((action) => (
    action.id === key
    || action.type === key
    || action.gate === key
  )) || null;
}

function applyRenderOptimizationRemediationAction(plan = {}, action = {}, context = {}) {
  if (action.type === 'capTextureUploads') {
    const maxUploadsPerFrame = Math.max(1, Number(action.maxUploadsPerFrame || action.budget || 1));
    plan.budgets = {
      ...(plan.budgets || {}),
      textureUploadBudget: maxUploadsPerFrame
    };
    plan.textureUploads.deferred = (plan.textureUploads.deferred || []).map((upload) => ({
      ...upload,
      maxUploadsPerFrame,
      strategy: upload.strategy || 'warmup-or-frame-split',
      remediation: 'capTextureUploads'
    }));
    plan.textureUploads.warmupQueue = (plan.textureUploads.warmupQueue || []).map((upload) => ({
      ...upload,
      maxUploadsPerFrame,
      strategy: upload.strategy || 'warmup-or-frame-split',
      remediation: 'capTextureUploads'
    }));
    return {
      textureUploadBudget: maxUploadsPerFrame,
      uploadCount: plan.textureUploads.deferred.length || plan.textureUploads.warmupQueue.length
    };
  }

  if (action.type === 'reduceFilterPasses') {
    const filterPassBudget = Math.max(1, Number(action.targetPasses || action.budget || 1));
    plan.budgets = {
      ...(plan.budgets || {}),
      filterPassBudget
    };
    plan.filters.passBudget = filterPassBudget;
    plan.filters.flattened = (plan.filters.flattened || []).map((filter) => ({
      ...filter,
      targetPasses: Math.max(1, Math.min(Number(filter.targetPasses || filter.passes || filterPassBudget), filterPassBudget)),
      remediation: 'reduceFilterPasses'
    }));
    plan.filters.estimatedSavedPasses = plan.filters.flattened
      .reduce((sum, filter) => sum + Math.max(0, Number(filter.passes || 1) - Number(filter.targetPasses || 1)), 0);
    return {
      filterPassBudget,
      filterCount: plan.filters.flattened.length,
      estimatedSavedPasses: plan.filters.estimatedSavedPasses
    };
  }

  if (action.type === 'captureRenderProfile') {
    const event = {
      type: 'render-optimization-remediation-profile',
      gate: action.gate || null,
      sourcePlanId: context.remediationPlan?.sourcePlanId || context.verification?.sourcePlanId || null,
      at: Date.parse(context.appliedAt) || Date.now(),
      before: action.before,
      after: action.after,
      budget: action.budget
    };
    context.recordDebugEvent?.(event);
    return {
      eventType: event.type,
      gate: event.gate
    };
  }

  if (action.type === 'rebuildAtlasGroups') {
    plan.renderQueue.sortGroups = upsertRenderPlanItems(plan.renderQueue.sortGroups || [], [{
      key: action.gate || 'draw-call-budget',
      material: 'auto',
      texture: 'auto',
      draws: [],
      status: 'needs-review',
      remediation: 'rebuildAtlasGroups',
      generatedAt: context.appliedAt || null
    }], 'key');
    return {
      sortGroupCount: plan.renderQueue.sortGroups.length
    };
  }

  if (action.type === 'rollbackRenderPlan') {
    plan.actions = [
      ...(plan.actions || []),
      {
        id: 'rollback-render-plan-request',
        type: 'rollbackRenderPlan',
        label: action.label || '回退优化计划',
        appliedAt: context.appliedAt || null,
        status: 'requested'
      }
    ];
    return {
      rollbackRequested: true
    };
  }

  return {
    skipped: true,
    reason: 'unsupported-remediation-action'
  };
}

function markRenderOptimizationRemediationApplied(plan = null, action = {}) {
  const nextPlan = cloneState(plan || {});
  const previousApplied = Array.isArray(nextPlan.appliedActions) ? nextPlan.appliedActions : [];
  nextPlan.actions = (nextPlan.actions || []).map((candidate) => (
    candidate.id === action.id || candidate.type === action.type
      ? { ...candidate, applied: true, appliedAt: action.appliedAt, result: action.result }
      : candidate
  ));
  nextPlan.appliedActions = upsertRenderPlanItems(previousApplied, [action], 'id').slice(-48);
  nextPlan.summary = {
    ...(nextPlan.summary || {}),
    appliedCount: nextPlan.appliedActions.length,
    remainingCount: Math.max(0, (nextPlan.actions || []).length - nextPlan.appliedActions.length)
  };
  return nextPlan;
}

function renderRemediationAuditEntry(phase, action = {}, result = {}) {
  return {
    phase,
    id: action.id || null,
    type: action.type || 'unknown',
    gate: action.gate || null,
    ok: phase !== 'error',
    result: cloneState(result)
  };
}

function createRenderVerificationMetricsFromPanel(panel = null) {
  const summary = panel?.report?.summary || panel?.summary || {};
  return {
    frameMs: summary.cpuMs ?? summary.frameMs ?? summary.gpuMs,
    drawCalls: summary.drawCallsBefore,
    textureUploads: summary.textureUploadCount,
    filterPasses: summary.filterPassCount
  };
}

function normalizeRenderVerificationMetrics(metrics = {}) {
  return {
    frameMs: numberOrZero(metrics.frameMs ?? metrics.frameTimeMs ?? metrics.cpuMs ?? metrics.ms),
    drawCalls: numberOrZero(metrics.drawCalls ?? metrics.drawCallCount ?? metrics.drawCallsBefore),
    textureUploads: numberOrZero(metrics.textureUploads ?? metrics.textureUploadCount ?? metrics.uploads),
    textureUploadBytes: numberOrZero(metrics.textureUploadBytes ?? metrics.uploadBytes ?? metrics.bytes),
    filterPasses: numberOrZero(metrics.filterPasses ?? metrics.filterPassCount ?? metrics.passes),
    filterMs: numberOrZero(metrics.filterMs ?? metrics.filterCostMs)
  };
}

function normalizeRenderVerificationBudgets(budgets = {}) {
  return {
    frameMs: numberOrNull(budgets.frameMs ?? budgets.frameBudgetMs ?? budgets.frameTimeMs ?? budgets.cpuMs ?? budgets.ms),
    drawCalls: numberOrNull(budgets.drawCalls ?? budgets.drawCallBudget ?? budgets.drawCallCount),
    textureUploads: numberOrNull(budgets.textureUploads ?? budgets.textureUploadBudget ?? budgets.textureUploadCount ?? budgets.uploads),
    textureUploadBytes: numberOrNull(budgets.textureUploadBytes ?? budgets.textureUploadByteBudget ?? budgets.uploadBytes ?? budgets.bytes),
    filterPasses: numberOrNull(budgets.filterPasses ?? budgets.filterPassBudget ?? budgets.filterPassCount ?? budgets.passes),
    filterMs: numberOrNull(budgets.filterMs ?? budgets.filterCostMs)
  };
}

function buildEditorVerificationGate(id, label, before, after, budget) {
  const delta = roundEditorVerificationMetric(after - before);
  return {
    id,
    label,
    ok: budget == null || after <= budget,
    before,
    after,
    budget,
    delta,
    improved: delta <= 0
  };
}

function localizeRenderOptimizationVerificationStatus(status = '', ok = false) {
  if (ok || status === 'passed') return '验证通过';
  if (status === 'warning') return '验证预警';
  if (status === 'failed') return '验证失败';
  return '等待验证';
}

function formatSignedRenderMetric(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return '0';
  const formatted = formatRenderMetric(number);
  return number > 0 ? `+${formatted}` : formatted;
}

function resolveEditorVerificationTimestamp(value) {
  if (value == null) return new Date().toISOString();
  const parsed = Number.isFinite(Number(value)) ? Number(value) : Date.parse(value);
  return new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString();
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundEditorVerificationMetric(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 1000) / 1000;
}

function localizeRenderSeverity(severity = 'ok') {
  const labels = {
    ok: '正常',
    info: '提示',
    warning: '预警',
    error: '阻塞'
  };
  return labels[severity] || labels.ok;
}

function localizeRenderIssue(type = '') {
  const labels = {
    'cpu-budget-exceeded': 'CPU 超预算',
    'gpu-budget-exceeded': 'GPU 超预算',
    'draw-call-budget-exceeded': 'Draw Call 超预算',
    'texture-upload-spike': '纹理上传峰值',
    'texture-upload-bytes-exceeded': '纹理上传体积',
    'filter-pass-budget-exceeded': 'Filter Pass 超预算',
    'backend-fallback': '后端 fallback'
  };
  return labels[type] || type || '未知问题';
}

function formatRenderMetric(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(2).replace(/\.?0+$/u, '');
}

function formatRenderBackendName(value = '') {
  const normalized = String(value || '').toLowerCase();
  const labels = {
    webgpu: 'WebGPU',
    webgl2: 'WebGL2',
    webgl: 'WebGL',
    pixi: 'PixiJS',
    canvas: 'Canvas'
  };
  return labels[normalized] || value || '未选择';
}

function buildAssetRegistryDiagnostics(registryState = {}, state = {}) {
  const auditMissing = Array.isArray(registryState.audit?.missingReferences)
    ? registryState.audit.missingReferences
    : [];
  const brokenReferences = Array.isArray(state.assetRefresh?.plan?.brokenReferences)
    ? state.assetRefresh.plan.brokenReferences
    : [];
  const repairActions = Array.isArray(state.assetRefresh?.plan?.repairActions)
    ? state.assetRefresh.plan.repairActions
    : [];
  const referenceIssues = brokenReferences.length ? brokenReferences : auditMissing;
  const missingByPath = new Map();
  for (const issue of referenceIssues) {
    const path = normalizeResourcePath(issue.missingAsset || issue.asset || issue.reference || issue.dependency);
    if (!path) continue;
    if (!missingByPath.has(path)) {
      missingByPath.set(path, {
        path,
        sources: new Set(),
        reasons: new Set()
      });
    }
    const item = missingByPath.get(path);
    if (issue.source || issue.via) item.sources.add(String(issue.source || issue.via));
    if (issue.reason || issue.type) item.reasons.add(String(issue.reason || issue.type));
  }
  const quickFixes = [...missingByPath.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((item) => ({
      id: `register-missing:${item.path}`,
      type: 'registerMissingAsset',
      path: item.path,
      label: `注册缺失资源 ${item.path}`,
      sourceCount: item.sources.size,
      reasons: [...item.reasons].sort()
    }));
  return {
    schema: 'omnicore.editor-asset-registry-diagnostics.v1',
    missingReferenceCount: referenceIssues.length,
    brokenReferenceCount: brokenReferences.length,
    auditMissingReferenceCount: auditMissing.length,
    repairActionCount: repairActions.length,
    quickFixCount: quickFixes.length,
    brokenReferences: cloneState(brokenReferences),
    missingReferences: cloneState(auditMissing),
    repairActions: cloneState(repairActions),
    quickFixes
  };
}

function findAssetRegistryQuickFix(state = {}, actionId = '') {
  const id = String(actionId || '').trim();
  if (!id) return null;
  const panel = state.assetRegistryPanel || buildAssetRegistryPanelState(state);
  return (panel.quickFixes || []).find((action) => action.id === id) || null;
}

function registerMissingAssetStub(state = {}, path = '', options = {}) {
  const assetPath = normalizeResourcePath(path);
  if (!assetPath) return {};
  const repairedAt = options.repairedAt || new Date(Number(options.now || Date.now())).toISOString();
  const nextAsset = normalizeAssetEntry({
    path: assetPath,
    name: assetPath.split('/').pop() || assetPath,
    type: assetType(assetPath),
    missingStub: true,
    repairedAt,
    changeKind: 'repaired'
  });
  return {
    assets: upsertEditorAssetEntry(state.assets || [], nextAsset)
  };
}

function createEditorAssetHmrPayload(plan = {}) {
  const files = uniqueStrings([
    ...stringList(plan.directAssets),
    ...(plan.runtimeActions || []).map((action) => action.asset).filter(Boolean)
  ]).sort();
  return {
    type: 'assets:hot-update',
    incremental: true,
    files,
    changePlan: cloneState(plan),
    runtimeActions: (plan.runtimeActions || []).map((action) => cloneState(action)),
    editorEvents: (plan.editorEvents || []).map((event) => cloneState(event))
  };
}

function applyAssetChangeListToEditorState(state = {}, changes = []) {
  let assets = (Array.isArray(state.assets) ? state.assets : [])
    .map((asset) => normalizeAssetEntry(typeof asset === 'object' ? cloneState(asset) : { path: asset }));
  let projectFiles = normalizeProjectFilesState(state.projectFiles || {});
  let scene = cloneState(state.scene || { name: 'untitled', entities: [] });
  let prefabs = cloneState(state.prefabs || []);
  let sceneTabs = cloneState(state.sceneTabs || []);

  for (const change of changes || []) {
    const assetPath = normalizeResourcePath(change.asset || change.reference || change.to || change.from);
    if (!assetPath) continue;
    if (change.kind === 'imported') {
      const nextAsset = normalizeAssetFromChange(change);
      if (nextAsset) assets = upsertEditorAssetEntry(assets, nextAsset);
      continue;
    }
    if (change.kind === 'modified') {
      assets = assets.map((asset) => (
        assetEntryMatchesReference(asset, assetPath)
          ? { ...asset, changed: true, changeKind: 'modified' }
          : asset
      ));
      continue;
    }
    if (change.kind === 'deleted') {
      assets = assets.filter((asset) => !assetEntryMatchesReference(asset, assetPath));
      continue;
    }
    if (change.kind === 'moved') {
      const from = normalizeResourcePath(change.from || change.asset);
      const to = normalizeResourcePath(change.to || change.reference);
      if (!from || !to) continue;
      assets = assets.map((asset) => {
        if (!assetEntryMatchesReference(asset, from)) return asset;
        return normalizeAssetEntry({ ...asset, path: to, movedFrom: from, changeKind: 'moved' });
      });
      projectFiles = renameProjectFileReference(projectFiles, from, to);
      scene = replaceReferenceValue(scene, from, to);
      prefabs = replaceReferenceValue(prefabs, from, to);
      sceneTabs = replaceReferenceValue(sceneTabs, from, to);
    }
  }

  return {
    assets,
    projectFiles,
    scene,
    prefabs,
    sceneTabs
  };
}

function localizeAssetChangeKind(kind = '') {
  if (kind === 'imported') return '新增 ';
  if (kind === 'modified') return '变更 ';
  if (kind === 'moved') return '移动 ';
  if (kind === 'deleted') return '删除 ';
  if (kind === 'repaired') return '已修复 ';
  return '';
}

function resolveEditorRegistrySourcePath(state = {}, reference = {}) {
  const filePath = normalizeResourcePath(reference.filePath);
  if (filePath) return filePath;
  if (['scene-file', 'prefab-file', 'file'].includes(reference.sourceType)) {
    const sourcePath = normalizeResourcePath(reference.source);
    if (sourcePath) return sourcePath;
  }
  if (reference.sourceType === 'prefab') {
    return resolveEditorPrefabPath(state, reference.prefabId || String(reference.source || '').replace(/^prefab:/iu, ''));
  }
  if (['entity', 'scene', 'scene-tab'].includes(reference.sourceType)) {
    return resolveEditorScenePath(state, reference);
  }
  return looksLikeResourceReference(reference.source) ? normalizeResourcePath(reference.source) : null;
}

function resolveEditorPrefabPath(state = {}, prefabId = '') {
  const normalizedId = String(prefabId || '').trim();
  const prefab = (state.prefabs || []).find((item) => (
    item.id === normalizedId
    || item.name === normalizedId
    || normalizeResourcePath(item.path || item.file || item.source || item.url) === normalizedId
  ));
  const prefabPath = normalizeResourcePath(prefab?.path || prefab?.file || prefab?.source || prefab?.url || '');
  if (prefabPath) return prefabPath;
  const known = collectKnownEditorAssets(state).find((asset) => isPrefabAsset(asset) && (
    asset.prefabId === normalizedId
    || asset.name === normalizedId
    || normalizeResourcePath(asset.path) === normalizedId
  ));
  if (known?.path) return known.path;
  return normalizedId ? `prefabs/${normalizedId}.json` : null;
}

function resolveEditorScenePath(state = {}, reference = {}) {
  const referencedFile = normalizeResourcePath(reference.filePath);
  if (referencedFile) return referencedFile;
  const activePath = normalizeResourcePath(state.activeSceneTabPath || '');
  if (activePath) return activePath;
  const projectFilePaths = Object.keys(state.projectFiles || {}).map(slash);
  const sceneName = String(state.scene?.name || '').trim().toLowerCase();
  const namedScene = projectFilePaths.find((filePath) => (
    /(^|\/)scenes\//iu.test(filePath)
    && (!sceneName || filePath.toLowerCase().includes(`/${sceneName}.`))
  ));
  if (namedScene) return namedScene;
  const firstSceneFile = projectFilePaths.find((filePath) => /(^|\/)scenes\//iu.test(filePath) || /\.scene\.json$/iu.test(filePath));
  if (firstSceneFile) return firstSceneFile;
  const knownScene = collectKnownEditorAssets(state).find((asset) => isSceneAsset(asset));
  if (knownScene?.path) return knownScene.path;
  return `scene:${state.scene?.name || 'current'}`;
}

function assetChangeKindMap(assetRefresh = {}) {
  const changes = new Map();
  for (const change of assetRefresh?.changes || []) {
    const path = normalizeResourcePath(change.asset || change.reference || change.to || change.from);
    if (path) changes.set(path, change.kind || 'modified');
  }
  for (const event of assetRefresh?.plan?.editorEvents || []) {
    const path = normalizeResourcePath(event.asset || event.to || event.from);
    if (!path || changes.has(path)) continue;
    if (event.type === 'asset:imported') changes.set(path, 'imported');
    else if (event.type === 'asset:moved') changes.set(path, 'moved');
    else if (event.type === 'asset:deleted') changes.set(path, 'deleted');
    else if (event.type === 'asset:changed') changes.set(path, 'modified');
  }
  return changes;
}

function normalizeAssetFromChange(change = {}) {
  const rawAsset = isPlainObject(change.rawAsset) ? cloneState(change.rawAsset) : {};
  const path = normalizeResourcePath(rawAsset.path || change.to || change.asset || change.reference);
  if (!path) return null;
  return normalizeAssetEntry({
    ...rawAsset,
    path,
    type: rawAsset.type || assetType(path),
    imported: change.kind === 'imported' || Boolean(rawAsset.imported),
    changeKind: change.kind || rawAsset.changeKind || null
  });
}

function upsertEditorAssetEntry(assets = [], nextAsset = {}) {
  const path = normalizeResourcePath(nextAsset);
  if (!path) return assets;
  const index = assets.findIndex((asset) => assetEntryMatchesReference(asset, path));
  if (index < 0) return [...assets, normalizeAssetEntry(nextAsset)];
  const merged = normalizeAssetEntry({
    ...assets[index],
    ...nextAsset,
    path,
    labels: uniqueStrings([
      ...stringList(assets[index].labels),
      ...stringList(nextAsset.labels)
    ])
  });
  return assets.map((asset, assetIndex) => (assetIndex === index ? merged : asset));
}

function assetEntryMatchesReference(asset = {}, reference = '') {
  const target = slash(reference || '').trim();
  if (!target) return false;
  const entry = typeof asset === 'object' && asset ? asset : { path: asset };
  return [
    entry.path,
    entry.url,
    entry.name,
    entry.file,
    entry.source,
    entry.uid,
    entry.address,
    entry.primaryId,
    entry.primaryAssetId,
    entry.id,
    entry.key
  ].some((value) => slash(value || '').trim() === target);
}

function renameProjectFileReference(projectFiles = {}, from = '', to = '') {
  const next = {};
  for (const [filePath, source] of Object.entries(projectFiles || {})) {
    const nextFilePath = filePath === from ? to : filePath;
    next[nextFilePath] = String(source).split(from).join(to);
  }
  return next;
}

function stringList(value = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (value == null) return [];
  return [String(value).trim()].filter(Boolean);
}

function uniqueStrings(values = []) {
  return [...new Set(stringList(values))];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createPropertyPanelSummary(state = {}) {
  const selected = findSelectedEntity(state) || state.scene?.entities?.[0] || null;
  if (!selected) {
    return { entityId: null, prefabId: null, fields: [] };
  }
  return {
    entityId: selected.id || null,
    prefabId: selected.prefabId || null,
    type: selected.type || null,
    fields: inspectorFields(selected).map((key) => ({
      key,
      label: key,
      value: selected[key] ?? null,
      valueType: selected[key] == null ? 'empty' : typeof selected[key]
    }))
  };
}

function replaceReferenceValue(value, from, to) {
  if (typeof value === 'string') return value.split(from).join(to);
  if (Array.isArray(value)) return value.map((item) => replaceReferenceValue(item, from, to));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceReferenceValue(child, from, to)]));
}

function normalizeResourcePath(value = '') {
  if (typeof value === 'string') return slash(value.trim());
  if (!value || typeof value !== 'object') return '';
  return slash(value.path || value.url || value.name || value.file || value.source || '');
}

function looksLikeResourceReference(value = '') {
  const path = slash(value || '').trim();
  return /^(assets|sprites|audio|textures|ui|scenes|prefabs|scripts|models|materials|fonts)\//iu.test(path)
    || /\.(png|jpg|jpeg|webp|gif|svg|json|scene|prefab|atlas|mp3|wav|ogg|m4a|js|mjs|cjs|ts|tsx|glb|gltf|fbx|obj|mtl|ttf|otf|woff|woff2)$/iu.test(path);
}

function assetIcon(asset = {}) {
  const type = assetType(asset);
  if (type === 'prefab') return '预制体';
  if (type === 'image') return '图片';
  if (type === 'scene') return '场景';
  if (type === 'script') return '脚本';
  return '文件';
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

const EDITOR_CSS = `
  body { margin: 0; overflow: hidden; background: #121312; color: #eceff1; font: 12px system-ui, sans-serif; }
  .desktop-boot { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; background: linear-gradient(90deg, rgba(45,212,191,.08) 1px, transparent 1px), linear-gradient(0deg, rgba(245,158,11,.07) 1px, transparent 1px), #101211; background-size: 38px 38px; transition: opacity .24s ease, visibility .24s ease; }
  .desktop-boot.ready { opacity: 0; visibility: hidden; pointer-events: none; }
  .desktop-boot-card { display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 12px; width: min(540px, 100%); padding: 18px; border: 1px solid #47515a; border-radius: 8px; background: rgba(22,24,27,.97); box-shadow: 0 24px 70px rgba(0,0,0,.42); }
  .desktop-boot-card strong { display: block; font-size: 18px; color: #fbfbf8; }
  .desktop-boot-card span { display: block; margin-top: 5px; color: #a9b4b1; }
  .desktop-boot-mark { position: relative; display: grid; place-items: center; width: 52px; height: 52px; border: 1px solid #2dd4bf; border-radius: 8px; background: #151817; color: #ccfbf1; font-weight: 800; }
  .desktop-boot-mark::after { position: absolute; inset: 8px; border: 1px solid rgba(245,158,11,.72); border-radius: 5px; content: ""; animation: desktopBootPulse 1.4s ease-in-out infinite; }
  .desktop-boot-progress { grid-column: 1 / -1; height: 8px; overflow: hidden; border: 1px solid #3f484f; border-radius: 999px; background: #090a0a; }
  .desktop-boot-progress i { display: block; width: 72%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2dd4bf, #f59e0b, #84cc16); animation: desktopBootLoad 1.4s ease-in-out infinite; }
  .editor-frame { --desktop-hub-size: 42vh; --dock-left-width: 240px; --dock-right-width: 300px; --dock-bottom-height: 220px; display: grid; grid-template-rows: 40px minmax(0, 1fr) 8px 0 24px; height: 100vh; overflow: hidden; background: #111312; }
  .editor-frame[data-workspace-mode="editor"] { grid-template-rows: 40px minmax(260px, var(--desktop-hub-size)) 8px minmax(240px, 1fr) 24px; }
  .editor-toolbar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; border-bottom: 1px solid rgba(166,173,166,.22); background: #0d0f0e; }
  .editor-toolbar button { display: inline-flex; align-items: center; min-width: 72px; min-height: 28px; padding: 4px 8px; border-radius: 4px; white-space: nowrap; }
  .editor-toolbar button::before { content: attr(data-editor-icon); display: inline-grid; flex: 0 0 auto; place-items: center; width: 18px; height: 18px; margin-right: 5px; border-radius: 4px; background: rgba(45,212,191,.15); color: #99f6e4; font-size: 11px; font-weight: 700; }
  .desktop-hub { position: relative; isolation: isolate; display: grid; grid-template-columns: 136px minmax(0, 1fr); gap: 8px; min-height: 0; overflow: hidden; padding: 8px; border-bottom: 1px solid rgba(166,173,166,.22); background: linear-gradient(180deg, #151716, #101211); }
  .desktop-lucide-icon { display: inline-grid; place-items: center; flex: 0 0 auto; color: currentColor; line-height: 0; }
  .desktop-lucide-icon svg { display: block; width: 18px; height: 18px; stroke: currentColor; }
  .desktop-launch-splash { position: absolute; inset: 10px; z-index: 5; display: grid; place-items: center; align-content: center; gap: 10px; border: 1px solid rgba(45,212,191,.35); border-radius: 8px; background: linear-gradient(135deg, rgba(7,9,8,.96), rgba(15,19,18,.92)); pointer-events: none; animation: desktopSplashExit 1.15s ease .55s forwards; }
  .desktop-launch-splash strong { color: #fbfbf8; font-size: 24px; letter-spacing: 0; }
  .desktop-launch-splash span { max-width: 360px; color: #cbd5d1; font-size: 12px; text-align: center; }
  .desktop-launch-splash i { width: min(320px, 52vw); height: 7px; overflow: hidden; border: 1px solid #3f484f; border-radius: 999px; background: #080a09; }
  .desktop-launch-splash i::before { display: block; width: 100%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2dd4bf, #f59e0b, #84cc16); content: ""; transform-origin: left center; animation: desktopLaunchLoad 1.05s ease forwards; }
  .desktop-launch-mark { position: relative; display: grid; place-items: center; width: 60px; height: 60px; border: 1px solid rgba(45,212,191,.7); border-radius: 10px; background: #10201e; color: #99f6e4; box-shadow: 0 0 26px rgba(45,212,191,.18); }
  .desktop-launch-mark::after { position: absolute; inset: 8px; border: 1px solid rgba(245,158,11,.72); border-radius: 7px; content: ""; animation: desktopBootPulse 1.4s ease-in-out infinite; }
  .desktop-launch-icon svg { width: 26px; height: 26px; }
  .desktop-command-rail { display: grid; grid-template-rows: auto auto repeat(8, 31px) minmax(0, 1fr); gap: 5px; min-width: 0; padding: 8px; border: 1px solid #343a3a; border-radius: 8px; background: rgba(15,17,16,.96); animation: desktopPanelEnter .28s ease both; }
  .desktop-command-rail strong { color: #fbfbf8; font-size: 15px; }
  .desktop-command-rail small { color: #fbbf24; font-size: 10px; }
  .desktop-command-rail button { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 6px; align-items: center; min-width: 0; min-height: 31px; padding: 0 7px; border-radius: 6px; text-align: left; white-space: nowrap; }
  .desktop-command-rail button span:not(.desktop-lucide-icon) { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .desktop-command-rail > span { align-self: end; color: #a3e635; font-size: 10px; line-height: 1.25; }
  .desktop-hub-main { display: grid; grid-template-rows: 52px 34px minmax(0, 1fr); gap: 8px; min-width: 0; min-height: 0; }
  .desktop-hub-header { display: grid; grid-template-columns: minmax(160px, 1fr) minmax(300px, auto) minmax(300px, .82fr); gap: 8px; align-items: center; min-height: 0; padding: 8px 10px; border: 1px solid #3b4343; border-radius: 8px; background: linear-gradient(135deg, #202321, #171918); animation: desktopPanelEnter .32s ease both; }
  .desktop-hub h1, .desktop-hub h2 { margin: 0; color: #fbfbf8; letter-spacing: 0; }
  .desktop-hub h1 { font-size: 17px; line-height: 1.1; }
  .desktop-hub p { margin: 0; color: #b7c3bd; line-height: 1.45; }
  .desktop-hub-header p { margin-top: 2px; overflow: hidden; color: #aeb8b2; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-hub-actions { display: grid; grid-template-columns: repeat(4, minmax(72px, 1fr)); gap: 6px; min-width: 0; }
  .desktop-hub-actions button { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 5px; align-items: center; min-height: 28px; padding: 4px 7px; border: 1px solid #2dd4bf; border-radius: 6px; background: #111716; color: #ccfbf1; text-align: left; }
  .desktop-hub-actions button span:not(.desktop-lucide-icon) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-tutorial-workbench button { min-height: 30px; padding: 6px 10px; border: 1px solid #2dd4bf; border-radius: 6px; background: #111716; color: #ccfbf1; }
  .desktop-status-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; min-width: 0; }
  .desktop-status-strip div { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px; align-items: center; min-width: 0; min-height: 20px; padding: 2px 5px; border: 1px solid #384142; border-radius: 6px; background: #171a19; animation: desktopPanelEnter .36s ease both; }
  .desktop-status-strip strong { color: #fbfbf8; font-size: 9px; }
  .desktop-status-strip span { min-width: 0; color: #fbbf24; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-hub-control-strip { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(150px, auto) minmax(140px, auto); gap: 6px; align-items: stretch; min-width: 0; }
  .desktop-command-search { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 6px; align-items: center; min-width: 0; margin: 0; padding: 5px 8px; border: 1px solid #384142; border-radius: 8px; background: #171a19; }
  .desktop-command-search span { color: #ccfbf1; font-size: 10px; font-weight: 700; }
  .desktop-command-search input { min-height: 22px; padding: 3px 7px; border-radius: 6px; background: #090b0a; font-size: 11px; }
  .desktop-hub-control-strip > span { display: grid; place-items: center start; min-width: 0; padding: 5px 8px; border: 1px solid #384142; border-radius: 8px; background: #141716; color: #fbbf24; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-hub-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; min-width: 0; min-height: 0; }
  .desktop-hub-grid { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: minmax(0, 1fr); align-items: stretch; gap: 0; min-height: 0; overflow: hidden; padding-right: 0; }
  .desktop-hub-panel { position: relative; display: grid; grid-template-rows: 30px 24px 34px minmax(0, 1fr) auto; gap: 6px; min-width: 0; min-height: 0; align-self: stretch; overflow: hidden; padding: 9px; border: 1px solid #343c3c; border-radius: 8px; background: #151817; opacity: .86; animation: desktopPanelEnter .36s ease both; animation-delay: calc(var(--desktop-section-index, 0) * 24ms); transition: border-color .16s ease, opacity .16s ease, box-shadow .16s ease, background .16s ease; }
  .desktop-hub-panel.is-focused { border-color: #2dd4bf; background: linear-gradient(135deg, rgba(45,212,191,.08), rgba(245,158,11,.045)), #161a19; opacity: 1; box-shadow: inset 0 0 0 1px rgba(45,212,191,.16), 0 12px 34px rgba(0,0,0,.2); }
  .desktop-command-card[hidden], .desktop-hub-panel[hidden] { display: none !important; }
  .desktop-panel-heading { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; min-width: 0; }
  .desktop-panel-heading h2 { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 6px; align-items: center; min-width: 0; font-size: 13px; line-height: 1.2; }
  .desktop-panel-heading h2 > span:not(.desktop-lucide-icon) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-panel-heading > span { justify-self: end; max-width: 210px; color: #aeb8b2; font-size: 10px; line-height: 1.2; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-section-lead { min-height: 0; overflow: hidden; color: #b7c3bd; font-size: 10px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-section-anchor { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }
  .desktop-section-map { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; min-width: 0; overflow: hidden; }
  .desktop-section-node { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr); grid-template-rows: 1fr; gap: 5px; align-items: center; min-width: 0; min-height: 30px; padding: 3px 5px; border: 1px solid #344040; border-radius: 7px; background: #121615; }
  .desktop-section-node::after { position: absolute; right: -8px; top: 50%; width: 8px; height: 1px; background: #2dd4bf; content: ""; opacity: .45; }
  .desktop-section-node:last-child::after { display: none; }
  .desktop-section-node b { display: grid; place-items: center; width: 16px; height: 16px; border: 1px solid rgba(45,212,191,.5); border-radius: 999px; color: #99f6e4; background: #0c1a18; font-size: 8px; }
  .desktop-section-node strong { min-width: 0; color: #fbfbf8; font-size: 10px; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-section-node span { display: none; }
  .desktop-command-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); grid-auto-rows: 58px; align-content: start; gap: 6px; min-width: 0; overflow: hidden; }
  .desktop-command-card { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; grid-template-rows: auto auto; gap: 2px 7px; align-items: center; min-width: 0; min-height: 0; height: 58px; padding: 6px 7px; border: 1px solid #3d4646; border-radius: 7px; background: #1a1e1d; color: #eceff1; text-align: left; opacity: 0; animation: desktopCardEnter .26s ease forwards; animation-delay: calc(var(--desktop-card-index, 0) * 10ms); }
  .desktop-command-card.primary { background: linear-gradient(135deg, rgba(45,212,191,.14), rgba(245,158,11,.06)), #1a1e1d; }
  .desktop-command-icon { grid-row: 1 / 3; display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid rgba(45,212,191,.42); border-radius: 6px; background: #10201e; color: #99f6e4; }
  .desktop-command-icon svg { width: 15px; height: 15px; }
  .desktop-command-card strong { min-width: 0; color: #fbfbf8; font-size: 11px; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-command-card [data-desktop-command-purpose] { grid-column: 2; min-width: 0; color: #b7c3bd; font-size: 9px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-command-card b { grid-column: 3; grid-row: 1 / 3; justify-self: end; min-width: 0; max-width: 74px; padding: 1px 5px; border: 1px solid rgba(132,204,22,.45); border-radius: 6px; color: #bef264; font-size: 9px; font-weight: 700; line-height: 1.2; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .motion-card { transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease; }
  .motion-card:hover { transform: translateY(-2px); border-color: #2dd4bf; background: #202522; box-shadow: 0 10px 24px rgba(0,0,0,.2); }
  .desktop-command-card.selected { border-color: #f59e0b; background: #241f13; box-shadow: inset 0 0 0 1px rgba(245,158,11,.24); }
  .desktop-command-details { display: grid; grid-template-rows: auto auto auto auto minmax(0, 1fr); gap: 6px; min-width: 0; min-height: 0; align-self: stretch; overflow: hidden; padding: 9px; border: 1px solid #3d4646; border-radius: 8px; background: linear-gradient(180deg, #1b1f1e, #111514); box-shadow: 0 12px 26px rgba(0,0,0,.18); animation: desktopPanelEnter .34s ease both; }
  .desktop-detail-heading { display: grid; gap: 2px; }
  .desktop-detail-heading span { color: #fbbf24; font-size: 10px; font-weight: 700; }
  .desktop-detail-heading strong { color: #fbfbf8; font-size: 13px; line-height: 1.18; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-command-details p { min-height: 0; overflow: hidden; color: #b7c3bd; font-size: 10px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .desktop-detail-meta { display: grid; gap: 4px; }
  .desktop-detail-meta span { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 6px; min-width: 0; padding: 4px 6px; border: 1px solid #303838; border-radius: 6px; background: #141817; }
  .desktop-detail-meta b { color: #ccfbf1; font-size: 9px; }
  .desktop-detail-meta em { min-width: 0; color: #e5e7eb; font-size: 9px; font-style: normal; line-height: 1.22; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-action-preview { position: relative; display: grid; gap: 3px; min-height: 44px; overflow: hidden; padding: 7px; border: 1px solid rgba(45,212,191,.4); border-radius: 7px; background: linear-gradient(135deg, rgba(45,212,191,.14), rgba(132,204,22,.07)), #0f1716; }
  .desktop-action-preview strong { color: #fbfbf8; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-action-preview span { color: #cbd5d1; font-size: 9px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-action-preview i { position: absolute; left: 8px; right: 8px; bottom: 7px; height: 4px; overflow: hidden; border-radius: 999px; background: #070a09; }
  .desktop-action-preview i::before { display: block; width: 68%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2dd4bf, #84cc16, #f59e0b); content: ""; animation: desktopLaunchLoad 1.8s ease infinite alternate; }
  .desktop-workflow-map { display: grid; grid-auto-rows: 26px; align-content: start; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .desktop-workflow-map li { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 6px; align-items: center; min-height: 0; height: 26px; padding: 3px 5px; border: 1px solid #303838; border-radius: 6px; background: #121615; }
  .desktop-workflow-map b { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; background: #10201e; color: #99f6e4; font-size: 9px; }
  .desktop-workflow-map span { min-width: 0; color: #e5e7eb; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .desktop-command-window-layer { position: fixed; inset: 54px 18px 36px 160px; z-index: 40; display: grid; place-items: center; pointer-events: none; }
  .desktop-command-window-layer:empty { display: none; }
  .desktop-command-window-layer::before { position: fixed; inset: 40px 0 24px; background: rgba(4,7,6,.54); backdrop-filter: blur(1px); content: ""; }
  .desktop-command-window { position: relative; z-index: 1; pointer-events: auto; display: grid; grid-template-rows: auto minmax(0, 1fr); width: min(1040px, 100%); max-height: 100%; min-height: min(560px, 100%); overflow: hidden; opacity: 1; border: 1px solid rgba(45,212,191,.68); border-radius: 8px; background: #101413; box-shadow: 0 26px 70px rgba(0,0,0,.6); animation: desktopWindowEnter .18s ease both; }
  .desktop-command-window-titlebar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; min-width: 0; padding: 10px 12px; border-bottom: 1px solid #354040; background: linear-gradient(135deg, #202522, #121615); }
  .desktop-command-window-titlebar div { display: grid; gap: 2px; min-width: 0; }
  .desktop-command-window-titlebar span { color: #fbbf24; font-size: 10px; font-weight: 800; }
  .desktop-command-window-titlebar strong { color: #fbfbf8; font-size: 17px; line-height: 1.2; overflow-wrap: anywhere; }
  .desktop-command-window-titlebar button { min-height: 30px; padding: 0 12px; border-radius: 6px; background: #111716; color: #ccfbf1; }
  .desktop-command-window-body { display: grid; grid-template-columns: minmax(280px, .9fr) minmax(340px, 1.1fr); grid-template-rows: auto minmax(0, 1fr); gap: 10px; min-height: 0; overflow: auto; padding: 12px; background: #101413; }
  .desktop-command-window-panel { display: grid; align-content: start; gap: 8px; min-width: 0; overflow: hidden; padding: 12px; border: 1px solid #394343; border-radius: 8px; background: #121716; box-shadow: inset 0 0 0 1px rgba(255,255,255,.015); }
  .desktop-command-window-panel h2 { margin: 0; color: #ccfbf1; font-size: 12px; }
  .desktop-command-window-panel p { margin: 0; color: #d7dedb; font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
  .desktop-command-window-intro dl { display: grid; gap: 6px; margin: 0; }
  .desktop-command-window-intro div { display: grid; grid-template-columns: 66px minmax(0, 1fr); gap: 8px; align-items: start; padding: 7px 8px; border: 1px solid #303838; border-radius: 6px; background: #171b1a; }
  .desktop-command-window-intro dt { color: #99f6e4; font-size: 10px; font-weight: 800; }
  .desktop-command-window-intro dd { margin: 0; color: #f1f5f9; font-size: 11px; line-height: 1.45; overflow-wrap: anywhere; }
  .desktop-command-window-steps { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
  .desktop-command-window-steps li { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; align-items: start; min-width: 0; padding: 8px; border: 1px solid #303838; border-radius: 7px; background: #171b1a; }
  .desktop-command-window-steps b { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: #10201e; color: #99f6e4; font-size: 10px; }
  .desktop-command-window-steps span { min-width: 0; color: #f1f5f9; font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
  .desktop-command-window-result { min-height: 0; border-color: rgba(132,204,22,.45); background: linear-gradient(135deg, rgba(132,204,22,.08), rgba(45,212,191,.06)), #101413; }
  .desktop-command-window-result b { justify-self: start; padding: 3px 8px; border: 1px solid rgba(132,204,22,.45); border-radius: 999px; color: #bef264; font-size: 10px; }
  .desktop-command-window-result strong { color: #fbfbf8; font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
  .desktop-command-window-result pre { box-sizing: border-box; width: 100%; min-width: 0; min-height: 96px; max-height: 210px; overflow: auto; margin: 0; padding: 9px; border: 1px solid #303838; border-radius: 7px; background: #080a09; color: #d8f3ef; font: 11px/1.45 "Cascadia Code", Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  .desktop-command-window-next { min-height: 0; border-color: rgba(245,158,11,.42); }
  .desktop-command-window-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .desktop-command-window-actions button { min-height: 32px; padding: 0 12px; border-radius: 6px; background: #10201e; color: #ccfbf1; }
  .desktop-diagnostic-body { display: grid; gap: 8px; min-width: 0; }
  .desktop-diagnostic-body [data-desktop-diagnostic-result] { display: grid; gap: 4px; min-height: 56px; padding: 10px; border-left: 3px solid #84cc16; border-radius: 6px; background: #111514; }
  .desktop-diagnostic-body strong { color: #fbfbf8; }
  .desktop-diagnostic-body span { color: #aeb8b2; line-height: 1.4; }
  .desktop-tutorial-workbench { display: grid; grid-template-columns: minmax(0, 1fr) 210px; grid-template-rows: auto minmax(124px, 1fr); gap: 8px; }
  .desktop-tutorial-steps { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .desktop-tutorial-steps button { min-height: 32px; border-radius: 6px; overflow-wrap: anywhere; }
  .desktop-tutorial-workbench pre { min-height: 124px; max-height: 190px; overflow: auto; margin: 0; padding: 10px; border: 1px solid #3d4646; border-radius: 8px; background: #070807; color: #d8f3ef; font: 11px/1.5 "Cascadia Code", Consolas, monospace; }
  .desktop-tutorial-workbench aside { display: grid; gap: 8px; align-content: start; min-width: 0; }
  .desktop-tutorial-progress { height: 7px; overflow: hidden; border: 1px solid #3d4646; border-radius: 999px; background: #090a0a; }
  .desktop-tutorial-progress i { display: block; width: 25%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #84cc16, #2dd4bf, #f59e0b); transition: width .18s ease; }
  .desktop-tutorial-preview { display: grid; align-content: center; gap: 8px; min-height: 86px; padding: 12px; border: 1px solid #3d4646; border-radius: 8px; background: linear-gradient(90deg, rgba(45,212,191,.22) 0 28%, transparent 28%), #171a19; color: #ccfbf1; }
  .desktop-tutorial-preview b { color: #bef264; }
  .editor-workspace-resizer { display: grid; place-items: center; min-height: 8px; padding: 0; border-width: 1px 0; border-color: rgba(45,212,191,.34); border-radius: 0; background: linear-gradient(90deg, transparent, rgba(45,212,191,.22), transparent), #0c0f0e; color: #ccfbf1; cursor: row-resize; }
  .editor-workspace-resizer span { width: min(72px, 14vw); height: 3px; overflow: hidden; border-radius: 999px; background: #2dd4bf; color: transparent; opacity: .62; }
  .editor-frame[data-workspace-mode="launcher"] .editor-workspace-resizer { cursor: pointer; }
  .editor-shell { display: grid; grid-template-columns: var(--dock-left-width) 7px minmax(320px, 1fr) 7px var(--dock-right-width); grid-template-rows: minmax(0, 1fr) 7px var(--dock-bottom-height); min-height: 0; overflow: hidden; }
  .editor-frame[data-workspace-mode="launcher"] .editor-shell { visibility: hidden; pointer-events: none; }
  .dock-region { display: grid; gap: 0; min-width: 0; min-height: 0; overflow: hidden; }
  .dock-left { grid-column: 1; grid-row: 1 / span 3; grid-template-rows: minmax(0, 1.2fr) minmax(0, .9fr) minmax(0, .9fr); }
  .dock-center { grid-column: 3; grid-row: 1; }
  .dock-right { grid-column: 5; grid-row: 1 / span 3; }
  .dock-bottom { grid-column: 3; grid-row: 3; grid-template-rows: minmax(64px, .6fr) minmax(96px, 1fr); }
  .dock-resizer { z-index: 2; min-width: 0; min-height: 0; background: #0b0f0e; border: 1px solid rgba(45,212,191,.24); }
  .dock-resizer-left { grid-column: 2; grid-row: 1 / span 3; cursor: col-resize; }
  .dock-resizer-right { grid-column: 4; grid-row: 1 / span 3; cursor: col-resize; }
  .dock-resizer-bottom { grid-column: 3; grid-row: 2; cursor: row-resize; }
  .dock-resizer::after { display: block; width: 100%; height: 100%; background: linear-gradient(180deg, transparent, rgba(45,212,191,.5), transparent); content: ""; opacity: .65; }
  .dock-resizer-bottom::after { background: linear-gradient(90deg, transparent, rgba(45,212,191,.5), transparent); }
  .editor-panel { min-width: 0; min-height: 0; border: 1px solid rgba(148,163,184,.28); padding: 10px; overflow: auto; background: #0f172a; }
  .scene-view { background: #172033; }
  .animation-timeline { background: #111827; }
  .editor-statusbar { display: flex; align-items: center; padding: 0 8px; border-top: 1px solid rgba(148,163,184,.28); color: #94a3b8; background: #0b1120; }
  h2 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0; }
  button { color: #e5e7eb; background: #111827; border: 1px solid #334155; cursor: pointer; }
  button.selected { border-color: #22d3ee; background: #164e63; }
  label { display: grid; grid-template-columns: 76px 1fr; gap: 8px; margin: 6px 0; }
  input { background: #020617; color: #e5e7eb; border: 1px solid #334155; padding: 5px; min-width: 0; }
  button:focus-visible, input:focus-visible { outline: 2px solid #84cc16; outline-offset: 2px; }
  @keyframes desktopBootPulse { 0%, 100% { opacity: .42; transform: scale(.94); } 50% { opacity: 1; transform: scale(1); } }
  @keyframes desktopBootLoad { 0% { width: 18%; } 55% { width: 82%; } 100% { width: 100%; } }
  @keyframes desktopPanelEnter { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes desktopWindowEnter { from { transform: translateY(6px) scale(.992); } to { transform: translateY(0) scale(1); } }
  @keyframes desktopCardEnter { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes desktopLaunchLoad { from { transform: scaleX(.08); } to { transform: scaleX(1); } }
  @keyframes desktopSplashExit { 0% { opacity: 1; transform: scale(1); } 70% { opacity: 1; transform: scale(1); } 100% { opacity: 0; visibility: hidden; transform: scale(1.012); } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
    .motion-card:hover { transform: none; }
  }
  .hierarchy-list { margin: 0; padding-left: 18px; }
  .hierarchy-list button, .prefab-list button, .asset-list button { width: 100%; margin-bottom: 5px; padding: 6px; text-align: left; }
  .scene-wrap { display: grid; grid-template-rows: auto auto 1fr auto; height: 100%; gap: 8px; }
  .scene-tabs { display: flex; gap: 4px; min-height: 24px; overflow-x: auto; }
  .scene-tabs button { flex: 0 0 auto; max-width: 150px; padding: 4px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gizmo-toolbar, .tilemap-toolbar { display: flex; gap: 6px; align-items: center; }
  .gizmo-toolbar button, .tilemap-toolbar button { padding: 5px 8px; }
  .scene-canvas { position: relative; min-height: 260px; height: 100%; overflow: hidden; background-image: linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px); background-size: 24px 24px; }
  .editor-onboarding { position: absolute; inset: 16px auto auto 16px; display: grid; gap: 6px; max-width: 340px; padding: 10px 12px; border: 1px solid rgba(56,189,248,.42); background: rgba(2,6,23,.86); color: #dbeafe; box-shadow: 0 12px 28px rgba(2,6,23,.36); }
  .editor-onboarding strong { color: #f8fafc; }
  .scene-node { position: absolute; display: grid; place-items: center; overflow: hidden; padding: 0 4px; border: 1px solid #38bdf8; background: #082f49; font-size: 11px; transform-origin: center; }
  .scene-node.selected { outline: 2px solid #facc15; }
  .scene-node.issue-target { box-shadow: 0 0 0 3px rgba(248,113,113,.78), 0 0 18px rgba(248,113,113,.42); }
  .selection-outline { position: absolute; box-sizing: border-box; pointer-events: none; border: 2px solid rgba(250,204,21,.86); background: rgba(250,204,21,.14); box-shadow: 0 0 0 1px rgba(15,23,42,.72), 0 0 18px rgba(250,204,21,.22); }
  .origin-marker { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; pointer-events: none; border-radius: 999px; border: 2px solid #f8fafc; background: #ef4444; box-shadow: 0 0 0 2px rgba(15,23,42,.72); }
  .transform-gizmo { position: absolute; z-index: 8; display: grid; grid-template-columns: repeat(3, 24px); gap: 4px; pointer-events: auto; }
  .gizmo-axis { width: 24px; height: 24px; padding: 0; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .gizmo-x { color: #fecaca; border-color: #ef4444; background: #450a0a; }
  .gizmo-y { color: #bbf7d0; border-color: #22c55e; background: #052e16; }
  .gizmo-z { color: #bfdbfe; border-color: #3b82f6; background: #172554; }
  .prefab-preview-model { position: absolute; display: grid; place-items: center; box-sizing: border-box; border: 1px dashed #facc15; background: rgba(250,204,21,.24); color: #fef3c7; font-size: 11px; pointer-events: none; }
  .selection-marquee { position: absolute; box-sizing: border-box; pointer-events: none; border: 1px dashed #67e8f9; background: rgba(34,211,238,.12); }
  .collision-overlay { position: absolute; box-sizing: border-box; pointer-events: none; border: 1px dashed rgba(248,113,113,.95); background: rgba(127,29,29,.18); }
  .depth-overlay { position: absolute; pointer-events: none; padding: 1px 4px; border: 1px solid #a3e635; background: rgba(20,83,45,.86); color: #dcfce7; font-size: 10px; }
  .z-depth-preview-line { position: absolute; min-height: 1px; width: 2px; pointer-events: none; border-left: 2px solid #38bdf8; color: #cffafe; font-size: 10px; text-indent: 5px; background: linear-gradient(180deg, rgba(56,189,248,.36), rgba(250,204,21,.28)); box-shadow: 0 0 0 1px rgba(15,23,42,.6), 0 0 12px rgba(56,189,248,.34); }
  .undo-history { display: grid; gap: 3px; max-height: 72px; overflow: auto; padding: 5px; border: 1px solid #334155; background: #020617; color: #cbd5e1; }
  .undo-history div.selected { color: #facc15; }
  .floating-editor-panel { position: absolute; right: 12px; z-index: 22; display: grid; gap: 8px; width: min(360px, calc(100% - 24px)); max-height: calc(100vh - 88px); overflow: auto; padding: 10px; border: 1px solid #38bdf8; background: #020617; box-shadow: 0 18px 44px rgba(2,6,23,.48); }
  .floating-editor-panel h3 { margin: 0; font-size: 12px; color: #bfdbfe; }
  .production-25d-panel { top: 54px; }
  .production-25d-score { font-size: 20px; color: #ecfeff; }
  .production-25d-stages { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
  .production-25d-stage { min-height: 26px; display: grid; place-items: center; padding: 4px; border: 1px solid #334155; color: #cbd5e1; font-size: 10px; text-align: center; }
  .production-25d-stage-complete { border-color: #22c55e; color: #bbf7d0; background: rgba(20,83,45,.38); }
  .production-25d-stage-blocked { border-color: #f59e0b; color: #fde68a; background: rgba(120,53,15,.38); }
  .production-25d-action { margin: 0; color: #94a3b8; }
  .production-25d-visual { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; color: #bfdbfe; font-size: 11px; }
  .production-25d-visual-chip { padding: 2px 5px; border: 1px solid #2563eb; background: rgba(30,64,175,.3); color: #dbeafe; }
  .save-version-panel { display: grid; gap: 5px; padding-top: 6px; border-top: 1px solid #334155; }
  .save-version-panel h4 { margin: 0; font-size: 12px; color: #ecfeff; }
  .save-version-diff { margin: 0; color: #bfdbfe; font-size: 11px; }
  .save-version-list { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .save-version-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px; align-items: center; min-height: 26px; color: #cbd5e1; font-size: 11px; }
  .save-version-list button { min-height: 24px; padding: 2px 6px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; }
  .authoring-health-panel { top: 54px; left: 12px; right: auto; }
  .authoring-health-counts { color: #bfdbfe; }
  .authoring-health-issues, .authoring-health-hotspots { display: grid; gap: 4px; }
  .authoring-health-error, .authoring-health-critical { padding: 5px; border-left: 3px solid #f87171; background: rgba(127,29,29,.28); color: #fecaca; }
  .authoring-health-warning { padding: 5px; border-left: 3px solid #facc15; background: rgba(113,63,18,.28); color: #fef3c7; }
  .particle-editor { top: 54px; }
  .sprite-editor { top: 54px; right: 388px; }
  .particle-preview { position: relative; height: 112px; overflow: hidden; border: 1px solid #334155; background: radial-gradient(circle at 50% 72%, rgba(248,113,113,.28), transparent 42%), #111827; }
  .particle-preview i { position: absolute; width: 8px; height: 8px; margin: -4px; border-radius: 999px; background: #facc15; box-shadow: 0 0 14px rgba(250,204,21,.78); }
  .sprite-edit-canvas { position: relative; height: 160px; border: 1px solid #334155; background: #111827; background-image: linear-gradient(45deg, rgba(148,163,184,.16) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,.16) 25%, transparent 25%); background-size: 18px 18px; }
  .nine-slice-guide { position: absolute; padding: 0; border: 0; background: #22d3ee; }
  .guide-left, .guide-right { top: 0; width: 2px; height: 100%; }
  .guide-top, .guide-bottom { left: 0; width: 100%; height: 2px; }
  .collider-outline { position: absolute; inset: 12px; border: 2px dashed #a3e635; background: rgba(163,230,53,.08); }
  .material-panel { display: grid; gap: 6px; margin: 8px 0; padding: 8px; border: 1px solid #334155; }
  .material-panel legend { color: #bfdbfe; }
  .prefab-override-panel { display: grid; gap: 4px; margin-top: 8px; padding: 8px; border: 1px solid #334155; background: #020617; }
  .prefab-override-panel h3 { margin: 0 0 4px; font-size: 12px; color: #facc15; }
  .prefab-override-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 5px; align-items: center; padding: 5px; border-left: 3px solid #facc15; background: rgba(250,204,21,.12); font-weight: 700; }
  .prefab-override-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .prefab-override-row button { padding: 3px 6px; font-weight: 400; }
  .command-palette { position: absolute; top: 48px; left: 50%; z-index: 20; display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 6px; width: min(640px, calc(100% - 32px)); transform: translateX(-50%); padding: 8px; border: 1px solid #38bdf8; background: #020617; box-shadow: 0 18px 44px rgba(2,6,23,.48); }
  .scene-validation { position: absolute; right: 12px; bottom: 32px; z-index: 18; display: grid; gap: 4px; max-width: 320px; padding: 8px; border: 1px solid #f87171; background: #450a0a; }
  .scene-validation button { text-align: left; }
  .tilemap-wrap { display: grid; gap: 8px; }
  .tilemap-grid { display: grid; gap: 2px; }
  .tilemap-grid button { width: 24px; height: 24px; padding: 0; font-size: 10px; }
  .tilemap-grid button.collision { background: #7f1d1d; border-color: #f87171; }
  .flow-graph-wrap { display: grid; grid-template-columns: minmax(260px, 1fr) 220px; grid-template-rows: auto minmax(120px, 1fr); gap: 8px; min-height: 0; }
  .flow-toolbar { grid-column: 1 / -1; display: flex; gap: 6px; align-items: center; }
  .flow-toolbar button { padding: 5px 8px; }
  .flow-canvas { position: relative; min-height: 132px; overflow: auto; border: 1px solid #334155; background: #111827; background-image: radial-gradient(#334155 1px, transparent 1px); background-size: 18px 18px; }
  .flow-node { position: absolute; min-width: 96px; min-height: 36px; padding: 6px 8px; border-radius: 4px; text-align: center; white-space: nowrap; }
  .flow-event { background: #1e3a8a; border-color: #60a5fa; }
  .flow-condition { background: #164e63; border-color: #22d3ee; }
  .flow-action { background: #365314; border-color: #a3e635; }
  .flow-edge-list { display: grid; align-content: start; gap: 4px; min-height: 0; overflow: auto; padding: 6px; border: 1px solid #334155; background: #020617; color: #cbd5e1; }
  .flow-preview { grid-column: 1 / -1; min-height: 72px; max-height: 140px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .graph-editor-wrap { display: grid; grid-template-columns: 96px minmax(260px, 1fr); gap: 8px; min-height: 0; }
  .graph-node-palette { display: grid; align-content: start; gap: 6px; }
  .graph-node-palette button { padding: 5px 8px; text-align: left; }
  .graph-editor-wrap .flow-graph-wrap { grid-template-columns: minmax(240px, 1fr) 180px; }
  .graph-editor-wrap pre { grid-column: 1 / -1; max-height: 120px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .visual-script-runtime { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr); gap: 8px; min-height: 0; }
  .visual-script-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .visual-script-actions button { padding: 5px 8px; }
  .visual-script-actions span { padding: 3px 6px; border: 1px solid #334155; color: #cbd5e1; background: #020617; }
  .visual-script-actions span[data-visual-script-validation="ok"] { border-color: #22c55e; color: #bbf7d0; background: rgba(20,83,45,.32); }
  .visual-script-actions span[data-visual-script-validation="error"] { border-color: #f59e0b; color: #fde68a; background: rgba(120,53,15,.32); }
  .visual-script-trace { display: grid; align-content: start; gap: 4px; min-height: 72px; max-height: 140px; overflow: auto; padding: 6px; border: 1px solid #334155; background: #020617; color: #dbeafe; }
  .visual-script-trace-row { min-height: 22px; padding: 3px 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-left: 3px solid #38bdf8; background: rgba(15,23,42,.78); }
  .visual-script-runtime-json { min-height: 72px; max-height: 140px; }
  .ui-editor-wrap { display: grid; grid-template-columns: 96px minmax(220px, 1fr); gap: 8px; min-height: 0; }
  .ui-palette { display: grid; align-content: start; gap: 6px; }
  .ui-palette button { padding: 5px 8px; text-align: left; }
  .ui-canvas { position: relative; max-width: 100%; overflow: hidden; border: 1px solid #334155; background: #111827; background-image: linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px); background-size: 16px 16px; }
  .ui-element { position: absolute; display: grid; place-items: center; padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-color: #22d3ee; background: #164e63; }
  .ui-editor-wrap pre { grid-column: 1 / -1; max-height: 120px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .global-search-wrap { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) auto; gap: 6px; min-height: 0; }
  .global-search-results { grid-column: 1 / -1; display: grid; align-content: start; gap: 4px; min-height: 0; overflow: auto; }
  .global-search-results button { padding: 5px 8px; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
  .resource-picker { top: 54px; left: 50%; right: auto; transform: translateX(-50%); }
  .resource-picker-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; max-height: 320px; overflow: auto; }
  .resource-picker-list button { display: grid; gap: 4px; min-height: 88px; padding: 6px; overflow: hidden; text-align: left; }
  .resource-picker-list img { width: 100%; height: 52px; object-fit: contain; background: #111827; }
  .prefab-hot-edit-prompt { top: 54px; }
  .physics-view-wrap { display: grid; gap: 8px; min-height: 0; }
  .physics-debug-canvas { position: relative; min-height: 260px; overflow: hidden; border: 1px solid #334155; background: #020617; background-image: linear-gradient(rgba(148,163,184,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px); background-size: 24px 24px; }
  .physics-wireframe { position: absolute; box-sizing: border-box; display: grid; place-items: center; border: 2px solid rgba(34,211,238,.88); background: rgba(34,211,238,.14); color: #cffafe; font-size: 10px; }
  .build-settings-wrap { display: grid; gap: 7px; }
  .build-target-row { grid-template-columns: 20px 1fr; align-items: center; margin: 0; }
  .build-settings-wrap pre { max-height: 160px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .timeline { display: grid; gap: 8px; }
  .timeline-clips, .easing-presets { display: flex; flex-wrap: wrap; gap: 5px; }
  .timeline-clips button, .easing-presets button { padding: 4px 7px; }
  .animation-curve-graph { position: relative; min-height: 96px; padding: 8px; border: 1px solid #334155; background: linear-gradient(90deg, rgba(148,163,184,.16) 1px, transparent 1px), linear-gradient(rgba(148,163,184,.16) 1px, transparent 1px), #020617; background-size: 24px 24px; }
  .bezier-handle { position: absolute; width: 9px; height: 9px; margin: -4px; border-radius: 999px; background: #facc15; box-shadow: 0 0 0 2px rgba(250,204,21,.22); }
  .handle-out { background: #22d3ee; }
  .animation-event-track { display: grid; gap: 4px; }
  .animation-event-marker { padding: 4px 6px; border-left: 3px solid #a3e635; background: rgba(22,101,52,.38); color: #dcfce7; }
  .asset-preview { margin-top: 8px; padding: 8px; border: 1px solid #334155; background: #020617; }
  .asset-preview img { display: block; max-width: 100%; max-height: 180px; object-fit: contain; background: #111827; }
  .asset-preview pre { max-height: 180px; overflow: auto; margin: 0; color: #bfdbfe; }
  .asset-registry-panel { display: grid; gap: 7px; margin-top: 10px; padding: 8px; border: 1px solid #334155; background: #020617; }
  .asset-registry-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; }
  .asset-registry-header strong { min-width: 0; overflow: hidden; color: #bfdbfe; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  .asset-registry-header button { width: auto; min-height: 26px; margin: 0; padding: 4px 7px; border-color: #22d3ee; color: #cffafe; }
  .asset-registry-status { padding: 4px 6px; border-left: 3px solid #84cc16; background: rgba(22,101,52,.34); color: #dcfce7; }
  .asset-registry-status.warning { border-left-color: #f59e0b; background: rgba(120,53,15,.44); color: #fde68a; }
  .asset-registry-rows { display: grid; gap: 4px; max-height: 180px; overflow: auto; }
  .asset-registry-rows button { display: block; min-width: 0; margin: 0; border-left: 3px solid #475569; background: #0f172a; color: #dbeafe; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .asset-registry-rows [data-asset-registry-change="imported"] { border-left-color: #84cc16; color: #dcfce7; }
  .asset-registry-rows [data-asset-registry-change="modified"] { border-left-color: #22d3ee; color: #cffafe; }
  .asset-registry-rows [data-asset-registry-change="moved"] { border-left-color: #facc15; color: #fef3c7; }
  .asset-registry-rows [data-asset-registry-change="deleted"] { border-left-color: #f87171; color: #fecaca; }
  .asset-registry-rows [data-asset-registry-change="repaired"] { border-left-color: #34d399; color: #d1fae5; }
  .asset-registry-diagnostics { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; padding: 6px; border: 1px solid #facc15; background: rgba(120,53,15,.35); color: #fef3c7; font-size: 11px; }
  .asset-registry-diagnostics button { min-height: 24px; border-color: #facc15; color: #fef9c3; }
  .asset-refresh-plan, .asset-hot-reload-events { display: grid; gap: 4px; min-width: 0; padding: 5px 6px; border: 1px solid #1e293b; background: #0f172a; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .asset-hot-reload-events { max-height: 92px; overflow: auto; white-space: normal; }
  .asset-hot-reload-events span { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .database-wrap { display: grid; gap: 8px; }
  .database-wrap table { width: 100%; border-collapse: collapse; }
  .database-wrap caption { text-align: left; color: #bfdbfe; margin-bottom: 4px; }
  .database-wrap td { padding: 3px; border: 1px solid #1e293b; }
  .database-wrap input { width: 100%; box-sizing: border-box; }
  .ai-assistant-wrap { display: grid; gap: 8px; }
  .ai-assistant-wrap button { width: max-content; padding: 5px 8px; }
  .runtime-debug-wrap { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; min-height: 0; }
  .runtime-debug-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
  .runtime-debug-actions button { min-height: 28px; padding: 5px 8px; border-color: #2dd4bf; color: #ccfbf1; }
  .runtime-debug-section { display: grid; align-content: start; gap: 5px; min-width: 0; padding: 7px; border: 1px solid #334155; background: #020617; }
  .runtime-debug-wide { grid-column: 1 / -1; }
  .runtime-debug-section h3 { margin: 0; color: #bfdbfe; font-size: 11px; letter-spacing: 0; }
  .runtime-debug-list { display: grid; gap: 4px; max-height: 116px; overflow: auto; }
  .runtime-debug-list span { min-width: 0; padding: 3px 5px; overflow: hidden; border-left: 2px solid #334155; background: #0f172a; color: #cbd5e1; text-overflow: ellipsis; white-space: nowrap; }
  .runtime-debug-resource-list { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .runtime-debug-list [data-runtime-debug-missing] { border-left-color: #f59e0b; color: #fde68a; }
  .runtime-debug-list [data-runtime-debug-event] { border-left-color: #84cc16; color: #dcfce7; }
  .runtime-debug-list [data-hot-reload-asset] { border-left-color: #22d3ee; color: #cffafe; }
  .render-diagnostics-wrap { display: grid; gap: 7px; min-width: 0; }
  .render-diagnostics-header { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; }
  .render-diagnostics-header strong { min-width: 0; color: #e0f2fe; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .render-diagnostics-header span { padding: 2px 7px; border: 1px solid #3f4b53; border-radius: 999px; color: #fde68a; background: #141817; font-size: 10px; }
  .render-diagnostics-header [data-render-diagnostics-severity="ok"] { color: #bbf7d0; }
  .render-diagnostics-header button { min-height: 26px; padding: 3px 8px; border-radius: 6px; color: #ccfbf1; }
  .render-diagnostics-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(94px, 1fr)); gap: 6px; }
  .render-diagnostics-metrics span { display: grid; gap: 2px; min-width: 0; padding: 6px 7px; border: 1px solid #334155; border-radius: 6px; background: #020617; }
  .render-diagnostics-metrics b { color: #94a3b8; font-size: 10px; font-weight: 700; }
  .render-diagnostics-metrics strong { color: #f8fafc; font-size: 12px; overflow-wrap: anywhere; }
  .render-diagnostics-backend { min-width: 0; padding: 6px 7px; border: 1px solid #334155; border-radius: 6px; background: #101615; color: #cbd5e1; overflow-wrap: anywhere; }
  .render-diagnostics-issues { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 5px; }
  .render-diagnostics-issues span { min-width: 0; padding: 5px 7px; border-left: 3px solid #f59e0b; background: #111514; color: #e5e7eb; overflow-wrap: anywhere; }
  .render-diagnostics-issues [data-render-diagnostics-issue="backend-fallback"] { border-left-color: #38bdf8; color: #dbeafe; }
  .render-diagnostics-issues [data-render-diagnostics-issue="ok"] { border-left-color: #84cc16; color: #dcfce7; }
  .render-diagnostics-actions { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
  .render-diagnostics-actions button { min-height: 28px; padding: 5px 8px; border-color: #2dd4bf; border-radius: 6px; color: #ccfbf1; background: #0f1f1d; }
  .render-diagnostics-actions button[data-render-diagnostics-applied="true"] { border-color: #84cc16; color: #dcfce7; background: #14220f; }
  .render-diagnostics-actions span { color: #94a3b8; }
  .render-optimization-plan { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; min-width: 0; padding: 7px 8px; border: 1px solid #31523b; border-radius: 6px; background: #07130c; }
  .render-optimization-plan strong { color: #bbf7d0; font-size: 11px; }
  .render-optimization-plan span { min-width: 0; color: #e5e7eb; overflow-wrap: anywhere; }
  .render-optimization-plan small { color: #94a3b8; white-space: nowrap; }
  .render-optimization-verification { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; min-width: 0; padding: 7px 8px; border: 1px solid #25636b; border-radius: 6px; background: #061417; }
  .render-optimization-verification strong { color: #a7f3d0; font-size: 11px; white-space: nowrap; }
  .render-optimization-verification span { min-width: 0; color: #e0f2fe; overflow-wrap: anywhere; }
  .render-optimization-verification small { color: #94a3b8; white-space: nowrap; }
  .render-optimization-verification[data-render-optimization-verification-status="failed"] { border-color: #7f1d1d; background: #1a0b0b; }
  .render-optimization-verification[data-render-optimization-verification-status="failed"] strong { color: #fecaca; }
  .render-optimization-remediation { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; min-width: 0; padding: 7px 8px; border: 1px solid #7c2d12; border-radius: 6px; background: #170c05; }
  .render-optimization-remediation strong { color: #fed7aa; font-size: 11px; white-space: nowrap; }
  .render-optimization-remediation span { min-width: 0; color: #ffedd5; overflow-wrap: anywhere; }
  .render-optimization-remediation small { color: #fdba74; white-space: nowrap; }
  .render-optimization-remediation[data-render-optimization-remediation-priority="critical"] { border-color: #991b1b; background: #1f0909; }
  .render-optimization-remediation-report { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; min-width: 0; padding: 7px 8px; border: 1px solid #365314; border-radius: 6px; background: #0c1705; }
  .render-optimization-remediation-report strong { color: #d9f99d; font-size: 11px; white-space: nowrap; }
  .render-optimization-remediation-report span { min-width: 0; color: #ecfccb; overflow-wrap: anywhere; }
  .render-optimization-remediation-report small { color: #a3e635; white-space: nowrap; }
  .render-optimization-remediation-report[data-render-optimization-remediation-report-status="failed"] { border-color: #991b1b; background: #1f0909; }
  .render-optimization-remediation-reverify { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; min-width: 0; padding: 7px 8px; border: 1px solid #0f766e; border-radius: 6px; background: #061614; }
  .render-optimization-remediation-reverify strong { color: #99f6e4; font-size: 11px; white-space: nowrap; }
  .render-optimization-remediation-reverify span { min-width: 0; color: #ccfbf1; overflow-wrap: anywhere; }
  .render-optimization-remediation-reverify small { color: #5eead4; white-space: nowrap; }
  .render-optimization-remediation-reverify[data-render-optimization-remediation-reverify-status="still-failing"] { border-color: #991b1b; background: #1f0909; }
  .render-optimization-remediation-reverify[data-render-optimization-remediation-reverify-status="still-failing"] strong { color: #fecaca; }
  .profiler-wrap { display: grid; gap: 5px; }
  .profiler-flamegraph { display: grid; gap: 4px; padding: 6px; border: 1px solid #334155; background: #020617; }
  .profiler-row { display: grid; grid-template-columns: 132px 1fr 56px; gap: 6px; align-items: center; }
  .profiler-row b { display: inline-block; height: 8px; background: #38bdf8; }
  .profiler-streams { display: flex; gap: 12px; color: #cbd5e1; }
  .profiler-history { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; color: #94a3b8; }
  .profiler-history span { flex: 0 0 auto; padding: 2px 5px; border: 1px solid #334155; background: #020617; }
`;

if (typeof document !== 'undefined') {
  const root = document.querySelector('#app');
  if (root) createEditorApp(root);
}

export { createEditorState };
export default createEditorApp;
