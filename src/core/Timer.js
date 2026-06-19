/**
 * Frame-updated timer collection independent from browser setInterval drift.
 *
 * @example
 * const timer = new Timer();
 * timer.after(500, () => scene.push('menu'));
 * loop.subscribe((dt) => timer.update(dt * 1000));
 */
export class Timer {
  constructor() {
    this.tasks = new Set();
  }

  after(delay, callback) {
    const task = { delay, elapsed: 0, callback, repeat: false, cancelled: false };
    this.tasks.add(task);
    return () => {
      task.cancelled = true;
      this.tasks.delete(task);
    };
  }

  every(interval, callback) {
    const task = { delay: interval, elapsed: 0, callback, repeat: true, cancelled: false };
    this.tasks.add(task);
    return () => {
      task.cancelled = true;
      this.tasks.delete(task);
    };
  }

  update(deltaMs) {
    for (const task of [...this.tasks]) {
      if (task.cancelled) continue;
      task.elapsed += deltaMs;
      if (task.elapsed >= task.delay) {
        task.callback();
        if (task.repeat) {
          task.elapsed %= task.delay;
        } else {
          this.tasks.delete(task);
        }
      }
    }
  }

  clear() {
    this.tasks.clear();
  }
}

export default Timer;
