export const CATEGORY_BITS = Object.freeze({
  world: 1,
  player: 2,
  enemy: 4,
  bullet: 8,
  sensor: 16
});

/**
 * Collision category and mask helpers.
 *
 * @example
 * CollisionMask.filter('bullet', 'enemy');
 */
export class CollisionMask {
  static category(name) {
    if (typeof name === 'number') return name;
    return CATEGORY_BITS[name] || CATEGORY_BITS.world;
  }

  static mask(value) {
    if (Array.isArray(value)) {
      return [...new Set(value.map((item) => CollisionMask.category(item)))].reduce((sum, item) => sum + item, 0);
    }
    return CollisionMask.category(value);
  }

  static filter(category, mask) {
    return {
      category: CollisionMask.category(category),
      mask: CollisionMask.mask(mask)
    };
  }

  static allows(sourceFilter = {}, targetFilter = {}) {
    return contains(sourceFilter.mask, targetFilter.category) && contains(targetFilter.mask, sourceFilter.category);
  }
}

function contains(mask = 0, category = 0) {
  if (!category) return false;
  return Math.floor(mask / category) % 2 === 1;
}

export default CollisionMask;
