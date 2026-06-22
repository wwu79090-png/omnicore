# Render Optimization Verification

`RenderOptimizationRuntimeExecutor` can now close the loop after an editor-exported render optimization plan is applied. The executor still supports preview, apply, rollback, and transaction rollback, but `verifyAppliedPlan(applyReport, evidence)` adds a post-apply evidence report.

Use this when the editor or runtime has collected before/after render metrics:

```js
const verification = executor.verifyAppliedPlan(applyReport, {
  before: { frameMs: 22, drawCalls: 12, textureUploads: 4, filterPasses: 5 },
  after: { frameMs: 15.8, drawCalls: 6, textureUploads: 2, filterPasses: 2 },
  budgets: { frameMs: 16.67, drawCalls: 8, textureUploads: 2, filterPasses: 3 }
});
```

The returned report uses schema `omnicore.render-optimization-verification-report.v1` and includes:

- `status`: `passed`, `warning`, or `failed`.
- `ok`: true only when every budget gate passes.
- `gates`: frame time, draw call, texture upload, and filter pass budget checks.
- `regressions`: metrics that increased after applying the plan.
- `summary`: applied action count, saved draw calls, frame time delta, and gate totals.

This mirrors the useful parts of mature engine workflows: Unity-style profiler evidence, Unreal-style budget regressions, PixiJS batching and filter diagnostics, and Three.js renderer statistics. The important rule is that optimization is not considered complete just because an action ran. It must be measured against explicit scene or device budgets.

## Editor Diagnostics Panel

The desktop/editor shell exposes the same loop through `EditorAPI.verifyRenderOptimizationPlan(input)`. The editor stores the report as `state.renderOptimizationVerification`, emits `editor:render-optimization-verification`, includes the report in runtime sync payloads, and renders a compact verification block inside the render diagnostics panel.

This gives non-code users a visible answer after they apply quick fixes: whether the plan passed the runtime gates, how many gates passed, how many draw calls were saved, and whether frame time regressed.

When verification fails, the editor also creates `state.renderOptimizationRemediationPlan` and emits `editor:render-optimization-remediation-plan`. The plan maps failed gates to concrete follow-up work such as rolling back the applied render plan, rebuilding atlas groups, capping texture uploads per frame, reducing filter passes, or capturing another render profile sample.

Remediation actions can be applied through `EditorAPI.applyRenderOptimizationRemediation(actionId)`. Applied actions write back into the editor render optimization plan, update the runtime export budget, emit `editor:render-optimization-remediation-applied`, and mark progress in the diagnostics panel.
