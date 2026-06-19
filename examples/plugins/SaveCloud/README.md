# SaveCloud

Official OmniCore plugin for local-first cloud save slots.

```js
import SaveCloud from './src/index.js';

const cloud = SaveCloud.install({ namespace: 'my-game' });
await cloud.save('slot-1', { level: 4, hp: 80 });
const data = await cloud.load('slot-1');
```

The default adapter uses `localStorage` when available and an in-memory fallback in tests. Production projects can pass a custom adapter with `save(slot, data)`, `load(slot)`, and `list()`.
