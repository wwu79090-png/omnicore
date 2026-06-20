import OmniCore, {
  Dimension3D,
  StaticBatchCompiler,
  createHD2DFilter,
  createSpineFFDVertexShader
} from '../../../src/index.js';

const root = document.querySelector('#app');
const hd2d = createHD2DFilter({ toneSeparation: 4, chromaticAberration: 0.018 });
const ffdShader = createSpineFFDVertexShader({ strength: 0.42 });
const modelBatchPlan = StaticBatchCompiler.compileStaticModelInstances([
  { id: 'tower-a', url: 'city.glb', static: true, material: 'lit-city' },
  { id: 'tower-b', url: 'city.glb', static: true, material: 'lit-city' }
]);
const dimension = new Dimension3D({ debug: true });
const viewportSync = dimension.syncViewport2D({
  camera: { x: 96, y: 48, zoomLevel: 1 },
  viewport: { width: 960, height: 540 },
  layers: [{ id: 'background', factorX: 0.5, factorY: 0.5 }]
});
const editorWorkflow = {
  create25DPreview: 'available in packages/omnicore-editor',
  dynamicOcclusion: 'Dimension3D.PlaneLayer.composeScene2D',
  staticInstancing: modelBatchPlan.pipeline
};

root.innerHTML = `
  <section>
    <h1>OmniCore Industrial 2.5D Demo</h1>
    <p>HD-2D filter: ${hd2d.type}</p>
    <p>Spine FFD shader: ${ffdShader.type}</p>
    <p>3D city decor batches: ${modelBatchPlan.drawCallsBefore} -> ${modelBatchPlan.drawCallsAfter}</p>
    <p>Viewport sync: ${viewportSync.protocol}</p>
    <p>Editor command: create25DPreview</p>
  </section>
`;

globalThis.OmniCore25DDemo = {
  OmniCore,
  hd2d,
  ffdShader,
  modelBatchPlan,
  viewportSync,
  editorWorkflow
};
