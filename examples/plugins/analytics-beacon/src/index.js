export default {
  name: 'analytics-beacon',
  version: '1.0.0',
  install(context = {}) {
    const {
      game = null,
      transport = null,
      now = () => Date.now()
    } = context;
    const events = [];

    function track(name, payload = {}) {
      const event = {
        name,
        payload,
        gameId: game?.id || game?.name || 'omnicore-game',
        timestamp: now()
      };
      events.push(event);
      transport?.(event);
      return event;
    }

    track('plugin_installed', { plugin: 'analytics-beacon' });

    return {
      events,
      track,
      destroy() {
        track('plugin_destroyed', { plugin: 'analytics-beacon' });
        events.length = 0;
      }
    };
  }
};
