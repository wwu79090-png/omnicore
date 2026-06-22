export function createSceneServices(scene, game = {}) {
  const services = {
    game,
    load: game.loader || game.load || null,
    input: game.input || null,
    camera: game.camera || null,
    physics: game.physics || null,
    events: game.events || null,
    timer: game.timer || null,
    store: game.store || null,
    audio: game.audio || null
  };
  if (scene) {
    scene.services = services;
    scene.load = services.load;
    scene.input = services.input;
    scene.camera = services.camera;
    scene.physics = services.physics;
    scene.events = services.events;
    scene.store = services.store;
    scene.audio = services.audio;
    if (typeof scene.bindTimer === 'function') scene.bindTimer(services.timer);
    else scene.timer = services.timer;
  }
  return services;
}

export default createSceneServices;
