import { createOmniError } from '../core/OmniError.js';
import createGLTFImportWorkflow from './GLTFImportWorkflow.js';

const GLB_MAGIC = 'glTF';
const JSON_CHUNK_TYPE = 'JSON';

export async function importGLBFile(input = {}, options = {}) {
  const file = input.file || input.asset || input;
  const arrayBuffer = await resolveArrayBuffer(input, file);
  const parsed = parseGLB(arrayBuffer);
  const normalizedFile = normalizeFile(file, parsed.byteLength);
  const modelId = normalizeModelId(options.modelId || normalizedFile.name);
  const workflow = createGLTFImportWorkflow({
    file: normalizedFile,
    document: parsed.document
  }, {
    targetSceneId: options.targetSceneId || null,
    modelId,
    collider: options.collider || { shape: 'box', source: 'mesh-bounds' },
    physicsBackend: options.physicsBackend || 'rapier3d-compat'
  });

  return {
    schema: 'omnicore.glb-file-import.v1',
    glb: {
      magic: GLB_MAGIC,
      version: parsed.version,
      length: parsed.length,
      jsonByteLength: parsed.jsonByteLength,
      chunkCount: parsed.chunkCount
    },
    document: parsed.document,
    thumbnail: {
      type: 'model-preview',
      modelId,
      source: normalizedFile.path,
      label: normalizedFile.name
    },
    textureRelink: createTextureRelinkPlan(parsed.document),
    resourceRecord: {
      id: modelId,
      type: 'model',
      path: normalizedFile.path,
      byteLength: normalizedFile.byteLength,
      format: 'glb',
      importedAt: options.importedAt || null
    },
    workflow
  };
}

async function resolveArrayBuffer(input, file) {
  if (input.arrayBuffer instanceof ArrayBuffer) return input.arrayBuffer;
  if (ArrayBuffer.isView(input.arrayBuffer)) return input.arrayBuffer.buffer;
  if (typeof input.arrayBuffer === 'function') return input.arrayBuffer();
  if (file?.arrayBuffer instanceof ArrayBuffer) return file.arrayBuffer;
  if (ArrayBuffer.isView(file?.arrayBuffer)) return file.arrayBuffer.buffer;
  if (typeof file?.arrayBuffer === 'function') return file.arrayBuffer();
  throw createOmniError('GLBFileImporter', 'importGLBFile requires a file.arrayBuffer() source.');
}

function parseGLB(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 20) throw createOmniError('GLBFileImporter', 'Invalid GLB: file is too small.');
  const magic = readAscii(view, 0, 4);
  if (magic !== GLB_MAGIC) throw createOmniError('GLBFileImporter', `Invalid GLB magic: ${magic}`);
  const version = view.getUint32(4, true);
  if (version !== 2) throw createOmniError('GLBFileImporter', `Unsupported GLB version: ${version}`);
  const length = view.getUint32(8, true);
  if (length > view.byteLength) throw createOmniError('GLBFileImporter', 'Invalid GLB: declared length exceeds buffer length.');

  let offset = 12;
  let document = null;
  let jsonByteLength = 0;
  let chunkCount = 0;
  while (offset + 8 <= length) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = readAscii(view, offset + 4, 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > view.byteLength) throw createOmniError('GLBFileImporter', `Invalid GLB chunk length for ${chunkType}.`);
    chunkCount += 1;
    if (chunkType === JSON_CHUNK_TYPE) {
      jsonByteLength = chunkLength;
      const jsonText = new TextDecoder().decode(new Uint8Array(arrayBuffer, chunkStart, chunkLength)).trim();
      document = JSON.parse(jsonText);
    }
    offset = chunkEnd;
  }
  if (!document) throw createOmniError('GLBFileImporter', 'Invalid GLB: missing JSON chunk.');

  return {
    version,
    length,
    byteLength: view.byteLength,
    jsonByteLength,
    chunkCount,
    document
  };
}

function createTextureRelinkPlan(document = {}) {
  const images = Array.isArray(document.images) ? document.images : [];
  const missing = images
    .map((image, index) => ({ index, uri: image.uri || null }))
    .filter((image) => !image.uri);
  return {
    required: missing.length > 0,
    missing,
    action: missing.length ? 'relink-missing-textures' : 'none'
  };
}

function normalizeFile(file = {}, byteLength = 0) {
  const name = String(file.name || file.path?.split('/').pop() || 'asset.glb');
  return {
    name,
    path: String(file.path || file.url || `assets/${name}`),
    byteLength: Number(file.byteLength || file.size || byteLength || 0)
  };
}

function normalizeModelId(value) {
  return String(value || 'model')
    .replace(/\.(glb|gltf)$/iu, '')
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase() || 'model';
}

function readAscii(view, offset, length) {
  let text = '';
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(view.getUint8(offset + index));
  return text;
}

export default importGLBFile;
