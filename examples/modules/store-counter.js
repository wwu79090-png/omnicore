export const title = 'Store 计数器';
export const description = '演示响应式数据更新，不依赖本地构建。';

export async function run({ container }) {
  container.textContent = '';
  let count = 0;
  const panel = document.createElement('section');
  panel.innerHTML = `
    <p style="margin:0 0 10px;color:#cbd5e1">Store-like reactive counter</p>
    <button type="button" data-inc>增加</button>
    <strong data-value style="margin-left:12px;color:#38bdf8">0</strong>
  `;
  Object.assign(panel.style, {
    padding: '16px',
    color: '#e2e8f0',
    background: '#020617',
    border: '1px solid #1e293b',
    font: '14px system-ui'
  });
  container.appendChild(panel);
  const value = panel.querySelector('[data-value]');
  const button = panel.querySelector('[data-inc]');
  const onClick = () => {
    count += 1;
    value.textContent = String(count);
  };
  button.addEventListener('click', onClick);
  return () => button.removeEventListener('click', onClick);
}
