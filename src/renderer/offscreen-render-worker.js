let canvas = null;
let ctx = null;
let background = '#111827';

globalThis.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') {
    canvas = message.canvas;
    background = message.background || background;
    if (canvas) {
      canvas.width = message.width || canvas.width;
      canvas.height = message.height || canvas.height;
      ctx = canvas.getContext('2d');
    }
    return;
  }
  if (message.type === 'resize' && canvas) {
    canvas.width = message.width;
    canvas.height = message.height;
    return;
  }
  if (message.type === 'render') {
    render(message.commands || []);
    return;
  }
  if (message.type === 'destroy') {
    canvas = null;
    ctx = null;
  }
};

function render(commands) {
  if (!ctx || !canvas) return;
  for (const command of commands) {
    switch (command.type) {
      case 'clear':
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = command.color || background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        break;
      case 'tile':
        drawRect(command, tileColor(command.tile));
        break;
      case 'rect':
        drawRect(command, command.fill || '#1f2937');
        break;
      case 'sprite':
        drawSprite(command);
        break;
      case 'mask':
        ctx.save();
        ctx.beginPath();
        ctx.rect(command.x, command.y, command.width, command.height);
        ctx.clip();
        break;
      default:
        break;
    }
  }
}

function drawSprite(command) {
  ctx.save();
  ctx.globalAlpha = command.alpha ?? 1;
  ctx.translate(command.x, command.y);
  ctx.rotate(command.rotation || 0);
  ctx.scale(command.scaleX ?? 1, command.scaleY ?? 1);
  ctx.fillStyle = command.fill || '#38bdf8';
  ctx.fillRect(0, 0, command.width, command.height);
  if (command.texture) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '10px sans-serif';
    ctx.fillText(String(command.texture).slice(0, 24), 4, 14);
  }
  ctx.restore();
}

function drawRect(command, fill) {
  ctx.save();
  ctx.globalAlpha = command.alpha ?? 1;
  ctx.fillStyle = fill;
  ctx.fillRect(command.x, command.y, command.width, command.height);
  ctx.restore();
}

function tileColor(tile) {
  const hue = (Number(tile) * 47) % 360;
  return `hsl(${hue} 72% 56%)`;
}
