# Leaderboard

Official OmniCore plugin sample for a local-first leaderboard.

```js
import Leaderboard from './examples/plugins/Leaderboard/src/index.js';

const leaderboard = Leaderboard.install({ namespace: 'demo' });
await leaderboard.submit('stage-1', { playerId: 'shalu', score: 1440 });
console.log(await leaderboard.top('stage-1'));
```

Use it as the baseline for Steam, web, WeChat, or custom backend ranking adapters.
