# analytics-beacon

Small OmniCore plugin example for teams that need to connect runtime events to an external analytics backend.

The example is intentionally dependency-free:

- `install(context)` registers a `track` helper.
- `track(eventName, payload)` forwards structured events to a host-provided transport.
- `destroy()` flushes a final lifecycle event and removes references.

```js
import analyticsBeacon from './src/index.js';

const session = analyticsBeacon.install({
  game,
  transport: (event) => fetch('/analytics', {
    method: 'POST',
    body: JSON.stringify(event)
  })
});

session.track('level_start', { level: 1 });
```
