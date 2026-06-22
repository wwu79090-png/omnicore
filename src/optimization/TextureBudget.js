function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Produces a deterministic texture downgrade plan from runtime pressure.
 */
export function createTextureBudgetPlan({
  memoryMB = 512,
  textureBytes = 0,
  fps = 0,
  targetFps = null,
  activeTextures = 0,
  maxTextureMemoryRatio = 0.45,
  maxTextures = 96
} = {}) {
  const memoryBytes = Math.max(1, Number(memoryMB) || 1) * 1024 * 1024;
  const textureBudgetBytes = memoryBytes * clamp(Number(maxTextureMemoryRatio) || 0.45, 0.1, 0.9);
  const currentTextureBytes = Math.max(0, Number(textureBytes) || 0);
  const currentFps = Math.max(0, Number(fps) || 0);
  const target = Number.isFinite(Number(targetFps)) && Number(targetFps) > 0 ? Number(targetFps) : null;
  const reasons = [];

  if (currentTextureBytes > textureBudgetBytes) reasons.push('memory-pressure');
  if (target != null && currentFps > 0 && currentFps < target * 0.9) reasons.push('fps-pressure');
  if (Number(activeTextures) > Number(maxTextures)) reasons.push('texture-count-pressure');

  const memoryScale = currentTextureBytes > textureBudgetBytes
    ? clamp(textureBudgetBytes / Math.max(1, currentTextureBytes), 0.25, 1)
    : 1;
  const fpsScale = target != null && currentFps > 0 && currentFps < target
    ? clamp(currentFps / target, 0.35, 1)
    : 1;
  const countScale = Number(activeTextures) > Number(maxTextures)
    ? clamp(Number(maxTextures) / Math.max(1, Number(activeTextures)), 0.5, 1)
    : 1;
  const textureScale = clamp(Math.min(memoryScale, fpsScale, countScale), 0.25, 1);

  return {
    format: 'OmniCore.TextureBudgetPlan',
    ok: reasons.length === 0,
    textureBudgetBytes: Math.floor(textureBudgetBytes),
    textureBytes: currentTextureBytes,
    textureScale,
    particleScale: clamp(textureScale * 0.85, 0.2, 1),
    filterQuality: textureScale < 0.75 ? 'low' : textureScale < 1 ? 'medium' : 'high',
    mipmaps: textureScale >= 0.75,
    anisotropy: textureScale < 0.75 ? 1 : 4,
    reasons
  };
}

export default createTextureBudgetPlan;
