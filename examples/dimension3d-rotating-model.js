import OmniCore from '../src/index.js';

const scene3D = await new OmniCore.Dimension3D.Scene({ controls: 'orbit' }).init();
const cube = scene3D.add(scene3D.createRotatingBox({ rotationSpeed: { y: 1 } }));
scene3D.render(1 / 60);

export { cube, scene3D };
