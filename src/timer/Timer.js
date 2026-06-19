/**
 * Frame-driven timer utility.
 *
 * `Game` owns one Timer instance and updates it from the Loop. Scenes receive it
 * as `scene.timer`.
 *
 * @example
 * scene.timer.delay(500, () => scene.game.scene.push('menu'));
 * scene.timer.interval(1000, () => spawnEnemy());
 */
export class Timer {
  constructor() {
    this.tasks = new Set();
  }

  delay(ms, callback) {
    return this._add(ms, callback, false);
  }

  interval(ms, callback) {
    return this._add(ms, callback, true);
  }

  after(ms, callback) {
    return this.delay(ms, callback);
  }

  every(ms, callback) {
    return this.interval(ms, callback);
  }

  update(delta) {
    const deltaMs = delta <= 10 ? delta * 1000 : delta;
    for (const task of [...this.tasks]) {
      task.elapsed += deltaMs;
      while (task.elapsed >= task.ms && this.tasks.has(task)) {
        task.callback();
        if (task.repeat) {
          task.elapsed -= task.ms;
        } else {
          this.tasks.delete(task);
        }
      }
    }
  }

  clear() {
    this.tasks.clear();
  }

  _add(ms, callback, repeat) {
    const task = {
      ms: Math.max(1, Number(ms)),
      elapsed: 0,
      callback,
      repeat
    };
    this.tasks.add(task);
    return () => this.tasks.delete(task);
  }
}

export default Timer;
