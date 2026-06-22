# Achievements

Official OmniCore plugin sample for achievements, progress, and unlock events.

```js
import Achievements from './examples/plugins/Achievements/src/index.js';

const achievements = Achievements.install({
  definitions: [{ id: 'first-jump', title: 'First Jump', target: 1 }]
});
achievements.progress('first-jump', 1);
console.log(achievements.isUnlocked('first-jump'));
```
