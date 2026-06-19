export default {
  name: 'AudioMixer',
  version: '1.0.0',
  install({ game, buses = ['master', 'music', 'sfx'] } = {}) {
    const levels = Object.fromEntries(buses.map((bus) => [bus, 1]));
    const commit = () => game?.store?.set?.('audio:mixer', { ...levels });
    commit();
    return {
      setVolume(bus, volume) {
        levels[bus] = Math.max(0, Math.min(1, Number(volume)));
        commit();
      },
      getVolume(bus) {
        return levels[bus] ?? 1;
      },
      destroy() {}
    };
  }
};
