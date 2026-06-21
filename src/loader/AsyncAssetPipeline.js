async function defaultDecodeAsset(asset) {
  return {
    ...asset,
    decoded: true
  };
}

async function defaultUploadAsset(asset) {
  return {
    ...asset,
    uploaded: true
  };
}

/**
 * Small async asset pipeline that separates critical first-frame assets from
 * lazy background decode and upload work.
 */
export function createAsyncAssetPipeline({
  decodeAsset = defaultDecodeAsset,
  uploadAsset = defaultUploadAsset,
  onWarning = null
} = {}) {
  const backgroundQueue = [];
  const timeline = [];
  const stats = {
    decoded: 0,
    uploaded: 0,
    failed: 0
  };

  const processAsset = async (asset, phase) => {
    try {
      timeline.push({ phase: `${phase}:decode`, id: asset.id || asset.url });
      const decoded = await decodeAsset(asset);
      stats.decoded += 1;
      timeline.push({ phase: `${phase}:upload`, id: asset.id || asset.url });
      const uploaded = await uploadAsset(decoded);
      stats.uploaded += 1;
      return uploaded;
    } catch (error) {
      stats.failed += 1;
      onWarning?.({
        asset,
        phase,
        error,
        message: error?.message || String(error)
      });
      return {
        ...asset,
        failed: true,
        error: error?.message || String(error)
      };
    }
  };

  return {
    timeline,
    async loadFrame(assets = [], { firstFrameBudget = Infinity } = {}) {
      const critical = [];
      const deferred = [];
      for (const asset of assets) {
        if (asset.critical && critical.length < firstFrameBudget) critical.push(asset);
        else deferred.push(asset);
      }
      backgroundQueue.push(...deferred);
      const ready = [];
      for (const asset of critical) ready.push(await processAsset(asset, 'first-frame'));
      return {
        ready,
        deferred,
        pending: backgroundQueue.length
      };
    },
    async flushBackground({ limit = Infinity } = {}) {
      const processed = [];
      const count = Math.min(backgroundQueue.length, Math.max(0, Number(limit) || 0));
      for (let index = 0; index < count; index += 1) {
        const asset = backgroundQueue.shift();
        processed.push(await processAsset(asset, 'background'));
      }
      return processed;
    },
    pending() {
      return [...backgroundQueue];
    },
    report() {
      return {
        format: 'OmniCore.AsyncAssetPipeline',
        decoded: stats.decoded,
        uploaded: stats.uploaded,
        failed: stats.failed,
        pending: backgroundQueue.length,
        timeline: [...timeline]
      };
    }
  };
}

export default createAsyncAssetPipeline;
