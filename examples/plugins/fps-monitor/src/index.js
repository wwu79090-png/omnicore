export default {
  name: 'fps-monitor',
  version: '1.0.0',
  install({ game }) {
    const panel = document.createElement('div');
    panel.textContent = 'FPS --';
    Object.assign(panel.style, {
      position: 'fixed',
      left: '8px',
      top: '8px',
      padding: '4px 6px',
      background: 'rgba(15,23,42,0.8)',
      color: '#e2e8f0',
      font: '12px monospace',
      zIndex: '9999'
    });
    document.body.appendChild(panel);
    let frames = 0;
    let elapsed = 0;
    const unsubscribe = game.loop.subscribe((delta) => {
      frames += 1;
      elapsed += delta;
      if (elapsed >= 1) {
        panel.textContent = `FPS ${Math.round(frames / elapsed)}`;
        frames = 0;
        elapsed = 0;
      }
    });
    return {
      destroy() {
        unsubscribe?.();
        panel.remove();
      }
    };
  }
};
