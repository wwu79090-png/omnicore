import AICommandService from '../ai/AICommandService.js';

const METHODS = [
  'OmniCore.createGame(config)',
  'new OmniCore.Scene(name)',
  'scene.add(sprite)',
  'new OmniCore.Sprite(texture, options)',
  'new OmniCore.Tween(target, config)',
  'OmniCore.Backend.switch("canvas")',
  'game.scene.push("play")',
  'game.scene.pop()',
  'game.input.keyboard.isDown("KeyA")',
  'game.input.pointer.on("click", fn)',
  'scene.camera.follow(target)',
  'scene.timer.delay(ms, fn)',
  'OmniCore.DB.get("items", "potion")',
  'renderer.drawRect({ x, y, width, height })',
  'Store.get("score")',
  'Store.setValue("score", value)',
  'Entity.createEntity(type, props)'
];

export class ApiQuickPanel {
  constructor({ game = null, aiCommandService = null } = {}) {
    this.game = game;
    this.aiCommandService = aiCommandService;
    this.panel = null;
    this.boundKey = (event) => {
      if (event.key === 'F1') {
        event.preventDefault();
        this.toggle();
      }
    };
  }

  attach() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.boundKey);
  }

  toggle() {
    if (this.panel) {
      this.detachPanel();
      return;
    }
    this.panel = document.createElement('div');
    this.panel.dataset.omnicoreApiPanel = 'true';
    this.panel.innerHTML = `
      <strong>OmniCore API</strong>
      <form data-omnicore-ai-form="true" style="display:grid;gap:8px;margin:10px 0 14px">
        <input data-omnicore-ai-command="true" placeholder="AI: 创建一个速度5的玩家实体，按WASD控制" />
        <small data-omnicore-ai-status="true">AI command ready</small>
      </form>
      <ol>${METHODS.map((item) => `<li><code>${item}</code></li>`).join('')}</ol>
    `;
    Object.assign(this.panel.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '520px',
      maxWidth: '90vw',
      padding: '16px',
      color: '#e2e8f0',
      background: 'rgba(15,23,42,0.9)',
      border: '1px solid #38bdf8',
      zIndex: '2147483647',
      font: '13px monospace'
    });
    const input = this.panel.querySelector('[data-omnicore-ai-command]');
    const status = this.panel.querySelector('[data-omnicore-ai-status]');
    Object.assign(input.style, {
      boxSizing: 'border-box',
      width: '100%',
      padding: '8px',
      color: '#e2e8f0',
      background: '#020617',
      border: '1px solid rgba(148,163,184,0.65)'
    });
    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      status.textContent = 'AI command running...';
      const created = await this._runAICommand(text);
      status.textContent = `AI command injected ${created.length} entity/entities`;
    });
    document.body.appendChild(this.panel);
  }

  async _runAICommand(prompt) {
    const game = this.game || globalThis.OmniCore?.lookup?.('game') || null;
    const service = this.aiCommandService || game?.aiCommand || new AICommandService();
    return service.generateAndInject(prompt, game);
  }

  detachPanel() {
    this.panel?.remove?.();
    this.panel = null;
  }

  detach() {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.boundKey);
    this.detachPanel();
  }
}

export default ApiQuickPanel;
