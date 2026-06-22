import { instantiateSceneDocument } from './SceneDocument.js';

export class CollectionFactory {
  constructor({ scene = null } = {}) {
    this.scene = scene;
  }

  create({ idPrefix = 'collection', position = {}, properties = {} } = {}) {
    const document = instantiateSceneDocument(this.scene || { name: idPrefix, children: [] }, {
      uid: `collection:${idPrefix}`
    });
    const ids = {};
    const entities = document.children.map((node) => spawnNode({
      node,
      idPrefix,
      position,
      properties,
      ids
    }));
    return { idPrefix, ids, entities, source: document };
  }
}

function spawnNode({ node = {}, idPrefix, position, properties, ids }) {
  const localId = node.id;
  const id = `${idPrefix}/${localId}`;
  ids[localId] = id;
  const override = properties[localId] || {};
  return {
    ...node,
    ...override,
    id,
    x: Number(position.x || 0) + Number(node.transform?.x ?? node.x ?? 0),
    y: Number(position.y || 0) + Number(node.transform?.y ?? node.y ?? 0),
    props: { ...(node.props || {}), ...(override.props || {}) },
    children: (node.children || []).map((child) => spawnNode({ node: child, idPrefix: id, position: {}, properties, ids }))
  };
}

export default CollectionFactory;
