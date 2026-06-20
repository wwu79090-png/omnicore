# Frame Budget Governance

OmniCore keeps non-critical runtime work inside a per-frame budget with `FrameBudgetScheduler`.

## Strategy

- Queue non-critical jobs with `enqueue()` or `enqueueSliced()`.
- Use `enqueueSliced()` for long lists such as asset indexing, telemetry flushes, editor imports, and background validation.
- Each frame calls `runFrame({ frameTimeMs })`.
- The scheduler executes work until the declared frame budget is reached, then keeps remaining work queued for the next frame.
- Critical work can still run by passing `{ critical: true }`, but gameplay code should use this sparingly.

## Degradation

`FrameBudgetScheduler` counts consecutive frames whose `frameTimeMs` is above `targetFrameMs`. After `lowFpsThreshold` frames it emits a degradation payload:

```js
const scheduler = new FrameBudgetScheduler({
  frameBudgetMs: 4,
  targetFrameMs: 16,
  lowFpsThreshold: 2,
  degradationHandlers: [
    ({ level }) => renderer.setQualityProfile?.(level > 1 ? 'low' : 'balanced')
  ]
});
```

Recommended degradation order:

1. Disable non-essential post-processing.
2. Reduce particle limits.
3. Lower texture quality for newly loaded optional assets.
4. Defer telemetry, editor validation, and preview generation.

Core simulation, player input, save integrity, and collision correctness should not be disabled by this scheduler.

## Verification

Run:

```bash
npx vitest run tests/frame-budget-scheduler.test.js
```
