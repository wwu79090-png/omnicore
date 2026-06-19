import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('AiPathfinding', (OmniCore) => ({
  findPath(grid, start, goal) {
    return OmniCore.findPath ? OmniCore.findPath(grid, start, goal) : [start, goal].filter(Boolean);
  }
}));
