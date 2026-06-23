export function createEditorAuthoringModules() {
  return {
    visualScript: createAuthoringModule({
      id: 'visualScript',
      label: 'Visual Script Graph',
      panels: ['visual-scripting', 'graph-editor', 'flow-graph'],
      capabilities: [
        'drag-node-authoring',
        'event-binding',
        'runtime-trace',
        'breakpoints'
      ],
      runtimeSyncKeys: ['visualScript', 'visualScriptTrace']
    }),
    scene3DViewport: createAuthoringModule({
      id: 'scene3DViewport',
      label: '3D Viewport',
      panels: ['scene-3d-viewport', 'scene-3d-readiness'],
      capabilities: [
        'camera3d-preview',
        'light-preview',
        'pbr-material-preview',
        'gltf-animation-preview',
        'collider-debug-draw'
      ],
      runtimeSyncKeys: ['scene3DViewport', 'scene3DReadiness']
    }),
    prefabDependencyGraph: createAuthoringModule({
      id: 'prefabDependencyGraph',
      label: 'Prefab Dependency Graph',
      panels: ['prefab-dependency-graph', 'prefabs', 'assets'],
      capabilities: [
        'prefab-variant-audit',
        'nested-prefab-tracking',
        'missing-reference-repair',
        'scene-dependency-graph'
      ],
      runtimeSyncKeys: ['prefabDependencyGraph', 'assetRegistryPanel']
    }),
    webgpuPipeline: createAuthoringModule({
      id: 'webgpuPipeline',
      label: 'WebGPU Pipeline Diagnostics',
      panels: ['webgpu-pipeline', 'render-diagnostics'],
      capabilities: [
        'texture-upload-tracking',
        'buffer-lifecycle',
        'bind-group-cache',
        'pipeline-cache',
        'command-encoding',
        'device-lost-recovery'
      ],
      runtimeSyncKeys: ['webgpuPipeline', 'renderDiagnostics']
    }),
    dockWindow: createAuthoringModule({
      id: 'dockWindow',
      label: 'Dock Window Layout',
      panels: ['hierarchy', 'scene-view', 'inspector', 'runtime-debug'],
      capabilities: [
        'single-window-panel-open',
        'dock-region-routing',
        'layout-reset',
        'launcher-to-editor-switch'
      ],
      runtimeSyncKeys: ['dockLayout']
    }),
    runtimeSync: createAuthoringModule({
      id: 'runtimeSync',
      label: 'Runtime Sync',
      panels: ['runtime-debug', 'profiler'],
      capabilities: [
        'hot-reload-events',
        'editor-runtime-payload',
        'debug-timeline',
        'watch-server-change-stream'
      ],
      runtimeSyncKeys: ['debugTimeline', 'hotReloadQueue', 'runtimeSyncPayload']
    })
  };
}

function createAuthoringModule({
  id,
  label,
  panels,
  capabilities,
  runtimeSyncKeys
}) {
  return {
    id,
    label,
    panels: [...panels],
    capabilities: [...capabilities],
    runtimeSyncKeys: [...runtimeSyncKeys],
    status: 'active'
  };
}

export default createEditorAuthoringModules;
