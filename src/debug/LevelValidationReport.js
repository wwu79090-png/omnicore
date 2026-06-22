export class LevelValidationReport {
  static validate({ scene = {}, assets = {}, requiredSpawnPoints = [] } = {}) {
    const errors = [];
    const warnings = [];
    const nodes = flattenNodes(scene);
    validateDuplicateIds(nodes, errors);
    validateAssets(nodes, assets, errors);
    validateSpawnPoints(nodes, requiredSpawnPoints, errors);
    return {
      ok: errors.length === 0,
      nodeCount: nodes.length,
      errors,
      warnings
    };
  }
}

function validateDuplicateIds(nodes, errors) {
  const seen = new Set();
  for (const node of nodes) {
    if (!node.id) continue;
    if (seen.has(node.id)) {
      errors.push({
        code: 'duplicate-id',
        path: node.path,
        message: `Duplicate node id: ${node.id}`
      });
    }
    seen.add(node.id);
  }
}

function validateAssets(nodes, assets, errors) {
  const images = new Set(normalizeArray(assets.images || assets.image));
  for (const node of nodes) {
    if (node.texture && !images.has(node.texture)) {
      errors.push({
        code: 'missing-asset',
        path: node.path,
        asset: node.texture,
        message: `Texture is not declared in scene assets: ${node.texture}`
      });
    }
  }
}

function validateSpawnPoints(nodes, requiredSpawnPoints, errors) {
  const ids = new Set(nodes.map((node) => node.id).filter(Boolean));
  for (const spawn of requiredSpawnPoints || []) {
    if (!ids.has(spawn)) {
      errors.push({
        code: 'missing-spawn-point',
        path: '$.spawnPoints',
        spawn,
        message: `Required spawn point is missing: ${spawn}`
      });
    }
  }
}

function flattenNodes(root = {}) {
  const children = root.children || root.nodes || [];
  const output = [];
  children.forEach((child, index) => visitNode(`$.children[${index}]`, output, child));
  return output;
}

function visitNode(path, output, node = {}) {
  output.push({ ...node, path });
  normalizeArray(node.children || node.nodes).forEach((child, index) => {
    visitNode(`${path}.children[${index}]`, output, child);
  });
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default LevelValidationReport;
