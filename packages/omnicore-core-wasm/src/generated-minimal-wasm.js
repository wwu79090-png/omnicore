const I32 = 0x7f;
const F32 = 0x7d;
const EMPTY_BLOCK = 0x40;

const STORE_BASE = 1024;
const BUS_BASE = 16384;
const WORLD_META_BASE = 32768;
const WORLD_DATA_BASE = 65536;
const STORE_KEYS = 64;
const STORE_STRIDE = 8;
const BUS_STRIDE = 16;
const WORLD_META_STRIDE = 16;
const MAX_ENTITIES = 1024;
const ENTITY_STRIDE = 24;

function u32(value) {
  const bytes = [];
  let next = Math.max(0, Math.trunc(value));
  do {
    let byte = next % 128;
    next = Math.floor(next / 128);
    if (next !== 0) byte += 128;
    bytes.push(byte);
  } while (next !== 0);
  return bytes;
}

function i32(value) {
  const bytes = [];
  let next = Math.trunc(value);
  let more = true;
  while (more) {
    let byte = positiveMod(next, 128);
    next = Math.floor(next / 128);
    const sign = byte >= 64;
    more = !((next === 0 && !sign) || (next === -1 && sign));
    if (more) byte += 128;
    bytes.push(byte);
  }
  return bytes;
}

function positiveMod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function f32(value) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setFloat32(0, value, true);
  return [...new Uint8Array(buffer)];
}

function utf8(value) {
  return [...new TextEncoder().encode(value)];
}

function vector(items) {
  return [...u32(items.length), ...items.flat()];
}

function section(id, payload) {
  return [id, ...u32(payload.length), ...payload];
}

function type(params, results = []) {
  return [0x60, ...vector(params), ...vector(results)];
}

function memarg(align, offset = 0) {
  return [...u32(align), ...u32(offset)];
}

function locals(types = []) {
  const groups = [];
  let index = 0;
  while (index < types.length) {
    const fieldType = types[index];
    let count = 1;
    index += 1;
    while (types[index] === fieldType) {
      count += 1;
      index += 1;
    }
    groups.push([...u32(count), fieldType]);
  }
  return vector(groups);
}

function fn(typeIndex, body, localTypes = []) {
  const code = [...locals(localTypes), ...body, 0x0b];
  return { typeIndex, code: [...u32(code.length), ...code] };
}

const op = {
  block: (blockType = EMPTY_BLOCK) => [0x02, blockType],
  loop: (blockType = EMPTY_BLOCK) => [0x03, blockType],
  if: (blockType = EMPTY_BLOCK) => [0x04, blockType],
  else: [0x05],
  end: [0x0b],
  br: (depth) => [0x0c, ...u32(depth)],
  brIf: (depth) => [0x0d, ...u32(depth)],
  ret: [0x0f],
  localGet: (index) => [0x20, ...u32(index)],
  localSet: (index) => [0x21, ...u32(index)],
  localTee: (index) => [0x22, ...u32(index)],
  globalGet: (index) => [0x23, ...u32(index)],
  globalSet: (index) => [0x24, ...u32(index)],
  i32Load: (offset = 0) => [0x28, ...memarg(2, offset)],
  f32Load: (offset = 0) => [0x2a, ...memarg(2, offset)],
  i32Store: (offset = 0) => [0x36, ...memarg(2, offset)],
  f32Store: (offset = 0) => [0x38, ...memarg(2, offset)],
  i32Const: (value) => [0x41, ...i32(value)],
  f32Const: (value) => [0x43, ...f32(value)],
  i32Eqz: [0x45],
  i32Ne: [0x47],
  i32GtS: [0x4a],
  i32GeS: [0x4e],
  i32Add: [0x6a],
  i32Sub: [0x6b],
  i32Mul: [0x6c],
  f32Add: [0x92],
  f32Mul: [0x94]
};

function storeOffset(storeLocal = 0, keyLocal = 1) {
  return [
    ...op.i32Const(STORE_BASE),
    ...op.localGet(storeLocal),
    ...op.i32Const(STORE_KEYS),
    ...op.i32Mul,
    ...op.localGet(keyLocal),
    ...op.i32Add,
    ...op.i32Const(STORE_STRIDE),
    ...op.i32Mul,
    ...op.i32Add
  ];
}

function busOffset(busLocal = 0) {
  return [
    ...op.i32Const(BUS_BASE),
    ...op.localGet(busLocal),
    ...op.i32Const(BUS_STRIDE),
    ...op.i32Mul,
    ...op.i32Add
  ];
}

function metaOffset(worldLocal = 0) {
  return [
    ...op.i32Const(WORLD_META_BASE),
    ...op.localGet(worldLocal),
    ...op.i32Const(WORLD_META_STRIDE),
    ...op.i32Mul,
    ...op.i32Add
  ];
}

function entityOffset(worldLocal = 0, entityLocal = 1) {
  return [
    ...op.i32Const(WORLD_DATA_BASE),
    ...op.localGet(worldLocal),
    ...op.i32Const(MAX_ENTITIES + 1),
    ...op.i32Mul,
    ...op.localGet(entityLocal),
    ...op.i32Add,
    ...op.i32Const(ENTITY_STRIDE),
    ...op.i32Mul,
    ...op.i32Add
  ];
}

function createMinimalOmniCoreWasmBytes() {
  const types = [
    type([], [I32]),
    type([I32, I32, I32], [I32]),
    type([I32, I32], [I32]),
    type([I32], [I32]),
    type([I32, I32, F32, F32], [I32]),
    type([I32, I32], [F32]),
    type([I32, F32], [I32])
  ];

  const functions = [
    fn(0, [...op.i32Const(1)]),
    fn(0, [
      ...op.globalGet(0),
      ...op.localSet(0),
      ...op.globalGet(0),
      ...op.i32Const(1),
      ...op.i32Add,
      ...op.globalSet(0),
      ...op.localGet(0)
    ], [I32]),
    fn(1, [
      ...storeOffset(0, 1),
      ...op.localSet(3),
      ...op.localGet(3),
      ...op.localGet(2),
      ...op.i32Store(0),
      ...op.localGet(3),
      ...op.i32Const(1),
      ...op.i32Store(4),
      ...op.i32Const(1)
    ], [I32]),
    fn(1, [
      ...storeOffset(0, 1),
      ...op.localSet(3),
      ...op.localGet(3),
      ...op.i32Load(4),
      ...op.i32Eqz,
      ...op.if(I32),
      ...op.localGet(2),
      ...op.else,
      ...op.localGet(3),
      ...op.i32Load(0),
      ...op.end
    ], [I32]),
    fn(2, [
      ...storeOffset(0, 1),
      ...op.i32Load(4),
      ...op.i32Const(0),
      ...op.i32Ne
    ]),
    fn(3, [
      ...op.globalGet(1),
      ...op.localSet(1),
      ...op.globalGet(1),
      ...op.i32Const(1),
      ...op.i32Add,
      ...op.globalSet(1),
      ...op.localGet(1)
    ], [I32]),
    fn(1, [
      ...busOffset(0),
      ...op.localSet(3),
      ...op.localGet(3),
      ...op.localGet(1),
      ...op.i32Store(0),
      ...op.localGet(3),
      ...op.localGet(2),
      ...op.i32Store(4),
      ...op.localGet(3),
      ...op.localGet(3),
      ...op.i32Load(8),
      ...op.i32Const(1),
      ...op.i32Add,
      ...op.localTee(4),
      ...op.i32Store(8),
      ...op.localGet(4)
    ], [I32, I32]),
    fn(3, [...busOffset(0), ...op.i32Load(8)]),
    fn(3, [
      ...busOffset(0),
      ...op.localSet(1),
      ...op.localGet(1),
      ...op.i32Load(8),
      ...op.localSet(2),
      ...op.localGet(1),
      ...op.i32Const(0),
      ...op.i32Store(8),
      ...op.localGet(2)
    ], [I32, I32]),
    fn(3, [...busOffset(0), ...op.i32Load(0)]),
    fn(3, [...busOffset(0), ...op.i32Load(4)]),
    fn(3, [
      ...op.globalGet(2),
      ...op.localSet(1),
      ...op.globalGet(2),
      ...op.i32Const(1),
      ...op.i32Add,
      ...op.globalSet(2),
      ...metaOffset(1),
      ...op.localSet(2),
      ...op.localGet(2),
      ...op.i32Const(1),
      ...op.i32Store(0),
      ...op.localGet(2),
      ...op.localGet(0),
      ...op.i32Const(1),
      ...op.i32GtS,
      ...op.if(I32),
      ...op.localGet(0),
      ...op.i32Const(MAX_ENTITIES),
      ...op.i32GtS,
      ...op.if(I32),
      ...op.i32Const(MAX_ENTITIES),
      ...op.else,
      ...op.localGet(0),
      ...op.end,
      ...op.else,
      ...op.i32Const(1),
      ...op.end,
      ...op.i32Store(4),
      ...op.localGet(2),
      ...op.i32Const(0),
      ...op.i32Store(8),
      ...op.localGet(1)
    ], [I32, I32]),
    fn(3, [
      ...metaOffset(0),
      ...op.localSet(1),
      ...op.localGet(1),
      ...op.i32Load(0),
      ...op.localSet(2),
      ...op.localGet(2),
      ...op.localGet(1),
      ...op.i32Load(4),
      ...op.i32GtS,
      ...op.if(EMPTY_BLOCK),
      ...op.i32Const(0),
      ...op.ret,
      ...op.end,
      ...op.localGet(1),
      ...op.localGet(2),
      ...op.i32Const(1),
      ...op.i32Add,
      ...op.i32Store(0),
      ...entityOffset(0, 2),
      ...op.localSet(3),
      ...op.localGet(3),
      ...op.i32Const(1),
      ...op.i32Store(0),
      ...op.localGet(3),
      ...op.i32Const(0),
      ...op.i32Store(4),
      ...op.localGet(3),
      ...op.f32Const(0),
      ...op.f32Store(8),
      ...op.localGet(3),
      ...op.f32Const(0),
      ...op.f32Store(12),
      ...op.localGet(3),
      ...op.f32Const(0),
      ...op.f32Store(16),
      ...op.localGet(3),
      ...op.f32Const(0),
      ...op.f32Store(20),
      ...op.localGet(2)
    ], [I32, I32, I32]),
    fn(2, [
      ...entityOffset(0, 1),
      ...op.localSet(2),
      ...op.localGet(2),
      ...op.i32Load(0),
      ...op.i32Eqz,
      ...op.if(I32),
      ...op.i32Const(0),
      ...op.else,
      ...op.localGet(2),
      ...op.i32Const(0),
      ...op.i32Store(0),
      ...op.localGet(2),
      ...op.i32Const(0),
      ...op.i32Store(4),
      ...op.i32Const(1),
      ...op.end
    ], [I32]),
    fn(2, [...entityOffset(0, 1), ...op.i32Load(0)]),
    fn(4, [
      ...entityOffset(0, 1),
      ...op.localSet(4),
      ...op.localGet(4),
      ...op.i32Load(0),
      ...op.i32Eqz,
      ...op.if(EMPTY_BLOCK),
      ...op.i32Const(0),
      ...op.ret,
      ...op.end,
      ...op.localGet(4),
      ...op.i32Const(1),
      ...op.i32Store(4),
      ...op.localGet(4),
      ...op.localGet(2),
      ...op.f32Store(8),
      ...op.localGet(4),
      ...op.localGet(3),
      ...op.f32Store(12),
      ...op.i32Const(1)
    ], [I32]),
    fn(4, [
      ...entityOffset(0, 1),
      ...op.localSet(4),
      ...op.localGet(4),
      ...op.i32Load(0),
      ...op.i32Eqz,
      ...op.if(EMPTY_BLOCK),
      ...op.i32Const(0),
      ...op.ret,
      ...op.end,
      ...op.localGet(4),
      ...op.localGet(2),
      ...op.f32Store(16),
      ...op.localGet(4),
      ...op.localGet(3),
      ...op.f32Store(20),
      ...op.i32Const(1)
    ], [I32]),
    fn(5, [
      ...entityOffset(0, 1),
      ...op.localSet(2),
      ...op.localGet(2),
      ...op.i32Load(0),
      ...op.i32Eqz,
      ...op.if(F32),
      ...op.f32Const(0),
      ...op.else,
      ...op.localGet(2),
      ...op.f32Load(8),
      ...op.end
    ], [I32]),
    fn(5, [
      ...entityOffset(0, 1),
      ...op.localSet(2),
      ...op.localGet(2),
      ...op.i32Load(0),
      ...op.i32Eqz,
      ...op.if(F32),
      ...op.f32Const(0),
      ...op.else,
      ...op.localGet(2),
      ...op.f32Load(12),
      ...op.end
    ], [I32]),
    fn(6, [
      ...metaOffset(0),
      ...op.localSet(2),
      ...op.localGet(2),
      ...op.i32Load(0),
      ...op.localSet(3),
      ...op.i32Const(1),
      ...op.localSet(4),
      ...op.block(),
      ...op.loop(),
      ...op.localGet(4),
      ...op.localGet(3),
      ...op.i32GeS,
      ...op.brIf(1),
      ...entityOffset(0, 4),
      ...op.localSet(5),
      ...op.localGet(5),
      ...op.i32Load(0),
      ...op.i32Eqz,
      ...op.if(EMPTY_BLOCK),
      ...op.else,
      ...op.localGet(5),
      ...op.i32Load(4),
      ...op.i32Eqz,
      ...op.if(EMPTY_BLOCK),
      ...op.else,
      ...op.localGet(5),
      ...op.localGet(5),
      ...op.f32Load(8),
      ...op.localGet(5),
      ...op.f32Load(16),
      ...op.localGet(1),
      ...op.f32Mul,
      ...op.f32Add,
      ...op.f32Store(8),
      ...op.localGet(5),
      ...op.localGet(5),
      ...op.f32Load(12),
      ...op.localGet(5),
      ...op.f32Load(20),
      ...op.localGet(1),
      ...op.f32Mul,
      ...op.f32Add,
      ...op.f32Store(12),
      ...op.end,
      ...op.end,
      ...op.localGet(4),
      ...op.i32Const(1),
      ...op.i32Add,
      ...op.localSet(4),
      ...op.br(0),
      ...op.end,
      ...op.end,
      ...op.i32Const(1)
    ], [I32, I32, I32, I32])
  ];

  const exports = [
    ['memory', 0x02, 0],
    ['omni_version', 0x00, 0],
    ['omni_store_create', 0x00, 1],
    ['omni_store_set_i32', 0x00, 2],
    ['omni_store_get_i32', 0x00, 3],
    ['omni_store_has', 0x00, 4],
    ['omni_eventbus_create', 0x00, 5],
    ['omni_eventbus_emit', 0x00, 6],
    ['omni_eventbus_pending', 0x00, 7],
    ['omni_eventbus_drain', 0x00, 8],
    ['omni_eventbus_last_event', 0x00, 9],
    ['omni_eventbus_last_payload', 0x00, 10],
    ['omni_ecs_create', 0x00, 11],
    ['omni_ecs_create_entity', 0x00, 12],
    ['omni_ecs_destroy_entity', 0x00, 13],
    ['omni_ecs_is_alive', 0x00, 14],
    ['omni_ecs_add_position', 0x00, 15],
    ['omni_ecs_add_velocity', 0x00, 16],
    ['omni_ecs_get_position_x', 0x00, 17],
    ['omni_ecs_get_position_y', 0x00, 18],
    ['omni_ecs_step_movement', 0x00, 19]
  ];

  const typeSection = section(1, vector(types));
  const functionSection = section(3, vector(functions.map((item) => u32(item.typeIndex))));
  const memorySection = section(5, [0x01, 0x00, ...u32(8)]);
  const globalSection = section(6, vector([
    [I32, 0x01, ...op.i32Const(1), 0x0b],
    [I32, 0x01, ...op.i32Const(1), 0x0b],
    [I32, 0x01, ...op.i32Const(1), 0x0b]
  ]));
  const exportSection = section(7, vector(exports.map(([name, kind, index]) => [
    ...u32(utf8(name).length),
    ...utf8(name),
    kind,
    ...u32(index)
  ])));
  const codeSection = section(10, vector(functions.map((item) => item.code)));

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d,
    0x01, 0x00, 0x00, 0x00,
    ...typeSection,
    ...functionSection,
    ...memorySection,
    ...globalSection,
    ...exportSection,
    ...codeSection
  ]);
}

export const OMNICORE_CORE_WASM_BYTES = createMinimalOmniCoreWasmBytes();

export default OMNICORE_CORE_WASM_BYTES;
