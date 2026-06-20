# English Community Launch Post

## Hacker News Title

Show HN: OmniCore, a tiny 2D-first web game engine built by a student with AI help

## Reddit r/gamedev Title

I built a lightweight browser game engine as a student, with AI helping on tests/docs/tooling

## Post

Hi everyone,

I am building OmniCore, a small 2D-first JavaScript game engine for browser games and lightweight editor workflows.

The honest story is part of the project: I am building this as a student / small-team style open source project with very limited resources. AI helped me move faster on scaffolding, tests, documentation drafts, release checklists, and repeated debugging passes. The engine architecture, API tradeoffs, performance goals, and final validation are still manually reviewed and owned by me.

What is in the current version:

- Lean Core ESM is about 33KB.
- A 1000-sprite demo reaches 144 FPS on the demo setup.
- 590 tests are passing.
- PixiJS v8 rendering wrapper, Canvas fallback, scene stack, tween/input/loader basics.
- A lightweight editor/playground surface.
- Plugin workflow, WeChat mini game build support, and a 4MB package-size redline report.
- README now includes a 10-minute quickstart and a 144 FPS GIF.

What it is not:

- It is not trying to replace Unity, Godot, or Phaser.
- It is not a heavy 3D engine.
- It is not a finished commercial engine.

The goal is to make small browser games and prototypes easier to start, inspect, and ship without pulling in a huge editor-first workflow.

Links:

- GitHub: https://github.com/wwu79090-png/omnicore
- Online demo: https://omnicore.vercel.app/
- NPM: https://www.npmjs.com/package/omnicore

I would really appreciate feedback from people who have shipped browser games, web-based editors, or small game tools. If the direction looks useful, a GitHub star would help the project find its first users.
