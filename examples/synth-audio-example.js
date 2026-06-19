import OmniCore from '../src/index.js';

const audio = new OmniCore.AudioManager();

document.querySelector('#click')?.addEventListener('click', () => {
  audio.synthesize('uiClick', { volume: 0.25 });
});

document.querySelector('#compile')?.addEventListener('click', () => {
  audio.synthesize('compileSuccess', { volume: 0.35 });
});
