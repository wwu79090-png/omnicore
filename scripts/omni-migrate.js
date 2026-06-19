export function migrateSource({ source, file = '', from = '1.x', to = '2.x' } = {}) {
  const changes = [];
  let output = source;
  output = replace(output, 'OmniCore.Backend.use(', 'OmniCore.Backend.switch(', 'Backend.use -> Backend.switch', changes);
  output = replace(output, 'game.scene.currentScene', 'game.store.get("currentScene")', 'scene.currentScene -> store currentScene', changes);
  return { file, from, to, output, changes };
}

function replace(source, needle, replacement, label, changes) {
  if (!source.includes(needle)) return source;
  changes.push({ label, from: needle, to: replacement });
  return source.split(needle).join(replacement);
}

export default migrateSource;
