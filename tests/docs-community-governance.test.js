import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Chinese documentation and community governance surfaces', () => {
  it('documents core APIs with contextual use-case examples in docs/api', () => {
    const apiDoc = readFileSync('docs/api/core-methods.zh-CN.md', 'utf8');

    expect(apiDoc).toContain('常见使用场景');
    expect(apiDoc).toContain('OmniCore.Store.set');
    expect(apiDoc).toContain('OmniCore.Scene.add');
    expect(apiDoc).toContain('OmniCore.Loader.loadBundle');
    expect(apiDoc).toContain('创建角色');
    expect(apiDoc).toContain('加载地图');
  });

  it('ships a beginner guide that a zero-code user can follow from role creation to map loading', () => {
    const guide = readFileSync('docs/getting-started-zero.zh-CN.md', 'utf8');

    expect(guide).toContain('不用先理解引擎源码');
    expect(guide).toContain('创建角色');
    expect(guide).toContain('让角色移动');
    expect(guide).toContain('加载地图');
    expect(guide).toContain('截图');
    expect(existsSync('docs/tutorial-internal-test.md')).toBe(true);
  });

  it('adds a lightweight website Q&A component with three collapsible answers', () => {
    const qa = readFileSync('website/qa.html', 'utf8');

    expect(qa).toContain('data-omnicore-qa');
    expect(qa).toContain('如何加载资源？');
    expect(qa).toContain('如何调试？');
    expect(qa).toContain('如何把角色放进地图？');
    expect(qa.match(/<details/g)).toHaveLength(3);
  });
});
