import { describe, expect, it, vi } from 'vitest';
import {
  Container,
  Graphics,
  Tween
} from '../src/index.js';
import { createTypeDeclarationSource } from '../scripts/build.js';

describe('OmniCore full foundation acceptance gaps', () => {
  it('exposes direct Graphics helpers for line, triangle, and ring primitives', () => {
    const graphics = new Graphics();

    expect(graphics.line(0, 1, 10, 11)).toBe(graphics);
    expect(graphics.triangle(0, 0, 12, 0, 6, 10)).toBe(graphics);
    expect(graphics.ring(20, 20, 16, 8, 0, Math.PI)).toBe(graphics);

    expect(graphics.commands.map((command) => command.op)).toEqual([
      'moveTo',
      'lineTo',
      'polygon',
      'ring'
    ]);
    expect(graphics.commands[2].points).toEqual([
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 6, y: 10 }
    ]);
    expect(graphics.commands[3]).toMatchObject({
      op: 'ring',
      x: 20,
      y: 20,
      outerRadius: 16,
      innerRadius: 8,
      startAngle: 0,
      endAngle: Math.PI
    });
  });

  it('reports cumulative Container world rotation through the parent hierarchy', () => {
    const root = new Container({ name: 'root', rotation: Math.PI / 4 });
    const child = new Container({ name: 'child', rotation: Math.PI / 8 });

    root.addChild(child);

    expect(root.getWorldRotation()).toBeCloseTo(Math.PI / 4);
    expect(child.getWorldRotation()).toBeCloseTo((Math.PI / 4) + (Math.PI / 8));
  });

  it('keeps Tween onUpdate chainable like onComplete', () => {
    const target = { x: 0 };
    const update = vi.fn();
    const complete = vi.fn();
    const tween = Tween.to(target, { x: 10, duration: 10, autoplay: false })
      .onUpdate(update)
      .onComplete(complete)
      .start();

    expect(tween.update(5)).toBe(tween);
    expect(update).toHaveBeenCalledWith(tween);
    tween.update(5);
    expect(complete).toHaveBeenCalledWith(tween);
    expect(target.x).toBe(10);
  });

  it('publishes TypeScript declarations for final foundation APIs', () => {
    const declarations = createTypeDeclarationSource();

    expect(declarations).toContain('export class Graphics');
    expect(declarations).toContain('line(x1: number, y1: number, x2: number, y2: number): this;');
    expect(declarations).toContain('triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;');
    expect(declarations).toContain('ring(x: number, y: number, outerRadius: number, innerRadius?: number');
    expect(declarations).toContain('export class Container');
    expect(declarations).toContain('getWorldRotation(): number;');
    expect(declarations).toContain('export class Tween');
    expect(declarations).toContain('onUpdate(handler: (tween: this) => void): this;');
    expect(declarations).toContain('start(): this;');
  });
});
