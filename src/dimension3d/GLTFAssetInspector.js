export function inspectGLTFAsset(asset = {}, options = {}) {
  const document = asset.document || asset.gltf || asset;
  const materials = arrayFromValue(document.materials);
  const textures = arrayFromValue(document.textures);
  const images = arrayFromValue(document.images);
  const animations = arrayFromValue(document.animations);
  const skins = arrayFromValue(document.skins);
  const meshes = arrayFromValue(document.meshes);
  const missingTextures = collectMissingTextures({ materials, textures, images });
  const colliderReady = Boolean(options.collider || asset.collider);
  const lodReady = arrayFromValue(options.lods || asset.lods).length > 0;
  const compression = options.compression || asset.compression || {};
  const compressionReady = Boolean(compression.meshopt || compression.draco || document.extensionsUsed?.includes('EXT_meshopt_compression'));
  const recommendations = [];
  const repairActions = [];

  if (missingTextures.length) {
    recommendations.push('repairTextures:register-or-relink');
    for (const texture of missingTextures) {
      repairActions.push({
        type: 'registerMissingTexture',
        textureIndex: texture.textureIndex,
        materialIndex: texture.materialIndex,
        reason: texture.reason
      });
    }
  }
  if (!colliderReady) {
    recommendations.push('generateCollider:box');
    repairActions.push({ type: 'generateCollider', shape: 'box', source: 'mesh-bounds' });
  }
  if (!lodReady) {
    recommendations.push('generateLOD:medium-low');
    repairActions.push({ type: 'generateLOD', levels: ['medium', 'low'] });
  }
  if (!compressionReady) recommendations.push('enableCompression:meshopt-or-draco');

  return {
    schema: 'omnicore.gltf-asset-inspector.v1',
    path: asset.path || asset.url || null,
    byteLength: Number(asset.byteLength || asset.size || 0),
    summary: {
      meshCount: meshes.length,
      materialCount: materials.length,
      textureCount: textures.length,
      missingTextureCount: missingTextures.length,
      animationClipCount: animations.length,
      skinCount: skins.length,
      colliderReady,
      lodReady,
      compressionReady
    },
    materials: materials.map((material, index) => ({
      index,
      name: material.name || `material-${index + 1}`,
      hasBaseColorTexture: Boolean(material.pbrMetallicRoughness?.baseColorTexture),
      hasNormalTexture: Boolean(material.normalTexture),
      hasMetallicRoughnessTexture: Boolean(material.pbrMetallicRoughness?.metallicRoughnessTexture)
    })),
    missingTextures,
    animationClips: animations.map((clip, index) => clip.name || `clip-${index + 1}`),
    skins: skins.map((skin, index) => ({
      index,
      jointCount: arrayFromValue(skin.joints).length
    })),
    recommendations,
    repairActions
  };
}

function collectMissingTextures({ materials, textures, images }) {
  const missing = [];
  const seen = new Set();
  materials.forEach((material, materialIndex) => {
    const slots = [
      material.pbrMetallicRoughness?.baseColorTexture,
      material.pbrMetallicRoughness?.metallicRoughnessTexture,
      material.normalTexture,
      material.occlusionTexture,
      material.emissiveTexture
    ].filter(Boolean);
    for (const slot of slots) {
      const textureIndex = Number(slot.index);
      const texture = textures[textureIndex];
      if (!texture) {
        pushMissingTexture(missing, seen, { materialIndex, textureIndex, reason: 'texture-index-missing' });
        continue;
      }
      if (texture.source != null && !images[Number(texture.source)]) {
        pushMissingTexture(missing, seen, { materialIndex, textureIndex, imageIndex: Number(texture.source), reason: 'image-source-missing' });
      }
    }
  });
  textures.forEach((texture, textureIndex) => {
    if (texture?.source != null && !images[Number(texture.source)]) {
      pushMissingTexture(missing, seen, { materialIndex: null, textureIndex, imageIndex: Number(texture.source), reason: 'image-source-missing' });
    }
  });
  return missing;
}

function pushMissingTexture(missing, seen, issue) {
  const key = `${issue.textureIndex}:${issue.imageIndex ?? 'texture'}:${issue.reason}`;
  if (seen.has(key)) return;
  seen.add(key);
  missing.push(issue);
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default inspectGLTFAsset;
