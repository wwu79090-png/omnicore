export default {
  name: 'AiPathfinding',
  version: '1.0.0',
  install({ grid = [] } = {}) {
    return {
      findPath(start, goal) {
        const path = [start];
        let current = { ...start };
        while (current.x !== goal.x || current.y !== goal.y) {
          current = {
            x: current.x + Math.sign(goal.x - current.x),
            y: current.y + Math.sign(goal.y - current.y)
          };
          if (grid[current.y]?.[current.x] === 1) break;
          path.push({ ...current });
          if (path.length > 512) break;
        }
        return path;
      },
      destroy() {}
    };
  }
};
