import { describe, expect, it } from 'vitest';
import { Geom } from '../src/index.js';

describe('OmniCore advanced geometry factories', () => {
  it('creates Phaser-style geometry objects with bounds helpers', () => {
    const arc = Geom.arc(40, 50, 20, 0, Math.PI);
    const ellipse = Geom.ellipse(80, 90, 60, 30);
    const line = Geom.line(0, 0, 32, 24);
    const triangle = Geom.triangle(0, 0, 24, 0, 12, 18);
    const polygon = Geom.polygon([
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 60, y: 40 },
      { x: 20, y: 50 }
    ]);

    expect(arc).toMatchObject({
      type: 'arc',
      x: 40,
      y: 50,
      radius: 20,
      startAngle: 0,
      endAngle: Math.PI
    });
    expect(ellipse.bounds()).toMatchObject({ x: 50, y: 75, width: 60, height: 30 });
    expect(line.bounds()).toMatchObject({ x: 0, y: 0, width: 32, height: 24 });
    expect(triangle.bounds()).toMatchObject({ x: 0, y: 0, width: 24, height: 18 });
    expect(polygon.bounds()).toMatchObject({ x: 10, y: 10, width: 50, height: 40 });
  });

  it('detects points and intersections for complex polygons', () => {
    const hull = Geom.polygon([
      { x: 10, y: 10 },
      { x: 80, y: 20 },
      { x: 70, y: 70 },
      { x: 20, y: 60 }
    ]);
    const overlap = Geom.polygon([
      { x: 60, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 90 },
      { x: 60, y: 90 }
    ]);
    const far = Geom.polygon([
      { x: 140, y: 140 },
      { x: 180, y: 140 },
      { x: 180, y: 180 }
    ]);

    expect(hull.containsPoint(35, 35)).toBe(true);
    expect(hull.containsPoint(4, 35)).toBe(false);
    expect(hull.intersects(overlap)).toBe(true);
    expect(hull.intersects(far)).toBe(false);
  });

  it('supports circle, ellipse, line, and triangle hit testing', () => {
    expect(Geom.arc(20, 20, 10).containsPoint(20, 29)).toBe(true);
    expect(Geom.arc(20, 20, 10).containsPoint(20, 32)).toBe(false);
    expect(Geom.ellipse(50, 50, 40, 20).containsPoint(65, 50)).toBe(true);
    expect(Geom.ellipse(50, 50, 40, 20).containsPoint(80, 50)).toBe(false);
    expect(Geom.line(0, 0, 20, 0).containsPoint(10, 0.5)).toBe(true);
    expect(Geom.triangle(0, 0, 20, 0, 10, 20).containsPoint(10, 8)).toBe(true);
  });

  it('keeps Phaser-style PascalCase aliases for existing projects', () => {
    expect(Geom.Arc(20, 20, 10).bounds()).toMatchObject({ x: 10, y: 10, width: 20, height: 20 });
    expect(Geom.Ellipse(50, 50, 40, 20).containsPoint(65, 50)).toBe(true);
    expect(Geom.Line(0, 0, 20, 0).containsPoint(10, 0.5)).toBe(true);
    expect(Geom.Polygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]).containsPoint(2, 2)).toBe(true);
    expect(Geom.Triangle(0, 0, 20, 0, 10, 20).containsPoint(10, 8)).toBe(true);
  });
});
