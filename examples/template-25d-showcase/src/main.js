import OmniCore from 'omnicore-runtime';

const scene3D = new OmniCore.Dimension3D.Scene({ width: 800, height: 450 });
const crate = scene3D.addModel({ id: 'crate', url: 'crate.glb', bounds: { width: 2, height: 2, depth: 2 } });
scene3D.addLight('directional', { intensity: 1.4 });
scene3D.setSkybox({ texture: 'studio.hdr' });

const Character3D = scene3D.addCharacter2D({
  id: 'hero',
  sprite: { x: 380, y: 210, width: 32, height: 48 },
  scale: 0.05
});

console.log('2.5D ready', {
  crate,
  Character3D,
  collision: Character3D.intersects(crate),
  pick: scene3D.pickModelAt({ x: 400, y: 225 })
});
