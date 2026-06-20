const HELP = {
  Game: {
    name: 'OmniCore.createGame',
    signature: 'OmniCore.createGame(config)',
    params: [{ name: 'config', type: 'object', description: '游戏配置，包含 parent、renderer、debug、platform 等字段。' }],
    returns: 'Uninitialized Game instance; call init() when needed',
    example: 'const game = await OmniCore.createGame({ parent: "#app", renderer: "auto", debug: true }).init();'
  },
  'Store.set': {
    name: 'OmniCore.Store.setValue',
    signature: 'store.setValue(key, value)',
    params: [
      { name: 'key', type: 'string', description: '状态键。' },
      { name: 'value', type: 'any', description: '新状态值。' }
    ],
    returns: 'Stored value after middleware and emergencyPatch',
    example: 'game.store.setValue("currentScene", "Level1");'
  },
  'Renderer.drawRect': {
    name: 'Renderer.drawRect',
    signature: 'renderer.drawRect(x, y, width, height, color)',
    params: [
      { name: 'x', type: 'number', description: '左上角 X。' },
      { name: 'y', type: 'number', description: '左上角 Y。' },
      { name: 'width', type: 'number', description: '宽度。' },
      { name: 'height', type: 'number', description: '高度。' },
      { name: 'color', type: 'string|number', description: '颜色。' }
    ],
    returns: 'Renderer backend draw command result',
    example: 'game.renderer.drawRect(16, 16, 64, 64, "#38bdf8");'
  },
  'Renderer.drawPrimitive': {
    name: 'Renderer.drawPrimitive',
    signature: 'renderer.drawPrimitive(primitive)',
    params: [
      { name: 'primitive', type: 'VectorPrimitive', description: '由 createHousePrimitive/createRingPrimitive/createCapsulePrimitive/createCodeLayerPrimitive 创建的复合图元。' }
    ],
    returns: 'Renderer backend draw command result',
    example: 'renderer.drawPrimitive(OmniCore.createHousePrimitive({ x: 16, y: 16, width: 96, height: 80 }));'
  },
  'Entity.create': {
    name: 'Entity.createEntity',
    signature: 'Entity.createEntity(type, props)',
    params: [
      { name: 'type', type: 'string', description: '实体类型。' },
      { name: 'props', type: 'object', description: '坐标、尺寸和自定义属性。' }
    ],
    returns: 'Entity-like object',
    example: 'const hero = Entity.createEntity("player", { x: 80, y: 120 });'
  }
};

/**
 * @param {string} apiName API name.
 * @returns {object} Help descriptor.
 */
export function help(apiName) {
  const entry = HELP[apiName] || HELP[normalizeName(apiName)];
  if (entry) return { ...entry, params: entry.params.map((item) => ({ ...item })) };
  return {
    name: apiName,
    signature: `${apiName}(...)`,
    params: [],
    returns: 'unknown',
    example: `OmniCore.help("${apiName}")`,
    description: '暂未登记该 API。请查看 docs/api 或源码 JSDoc。'
  };
}

/**
 * @returns {Record<string, object>} Full help registry.
 */
export function listHelp() {
  return Object.fromEntries(Object.keys(HELP).map((key) => [key, help(key)]));
}

function normalizeName(apiName = '') {
  return String(apiName).replace(/^OmniCore\./, '');
}

export default { help, listHelp };
