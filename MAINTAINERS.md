# Maintainers

OmniCore uses a small-core maintainer model. Maintainers are responsible for release safety, API stability, and review quality.

## Current Areas

- Core runtime and public API contracts.
- Renderer, Tilemap, Physics, Worker and Store integrations.
- Tooling, CI, release, documentation and plugin SDK.

## Maintainer Duties

- Review PRs for compatibility, tests and performance impact.
- Reject manual version or `CHANGELOG.md` edits; use `standard-version`.
- Require `BREAKING CHANGE:` for any incompatible public API change.
- Keep benchmark thresholds realistic and enforced in CI.
- Keep debug tools behind `debug: true`.

## Contributor Promotion Path

OmniCore uses explicit contribution thresholds so external developers can understand how to grow into project responsibility.

### Triage

- A contributor becomes eligible for Triage after累计提交 `5 个有效的 Bug 复现或文档 PR`.
- Valid Bug reproduction work must include environment, steps, expected result, actual result, and a minimal repro or failing test when possible.
- Valid documentation PRs must improve user-facing setup, migration, plugin publishing, editor workflows, or release operations.
- Triage contributors can label issues, ask for reproduction details, close duplicates, and point users to the correct docs.

### Committer

- A contributor becomes eligible for Committer after累计合并 `10 个 PR`，且至少 `1 个来自自己`.
- At least one merged PR must include a test, docs verification, build script, or runnable example.
- Committers may merge approved PRs in their area after required checks pass.
- Committers may not publish npm packages, transfer repository settings, or bypass release gates.

### Maintainer

- A Maintainer candidate must be nominated by a current Maintainer.
- The nomination must summarize contribution history, review quality, release judgment, and any security-sensitive access requested.
- The promotion requires a vote and must be `投票通过` by the active Maintainer group.
- Maintainers can approve releases, manage package ownership, and participate in succession decisions.

## Bus Factor & Succession Plan

OmniCore treats maintainer loss as a project-continuity incident, not as a personal availability issue. The repository must always keep review, merge and publish rules clear enough for the community to continue without a single lead maintainer.

### 自动代码审查员升级规则

- Any contributor who submits more than `20 个有效的测试或 Bug 修复 PR` in the `近 3 个月` window becomes eligible for automatic Reviewer onboarding.
- A valid PR must include a regression test, focused bug fix, reproducible issue link, or measurable test coverage improvement. Documentation-only, formatting-only, dependency-only and reverted PRs do not count toward the threshold.
- Once the threshold is reached, maintainers must open or update a tracking issue labelled `governance:reviewer-promotion` within 7 days. If no maintainer objects with evidence of a regression, security issue or conduct violation, the contributor is automatically allowed to act as `代码审查员`.
- Reviewers may approve PRs, request changes, verify bug-fix evidence and help triage release blockers. Merge and NPM publish rights remain separate until the succession threshold below is met.

### 投票门槛与发布权限继承

- When the active contributor pool has `贡献者数量超过 3 人`, succession decisions may be made without the original Lead Maintainer.
- Consensus means at least 75% of active Reviewers and Maintainers approve, with no unresolved security or Code of Conduct objections after a 7-day voting window.
- If the Lead Maintainer is unreachable for 30 days during a release blocker, or unreachable for 7 days during an active security incident, the consensus group may inherit GitHub merge rights and `发布权限`.
- Before release permission transfer, the inheriting maintainers must enable 2FA, use npm provenance or trusted publishing where available, confirm package ownership in the GitHub issue, and record the decision in `CHANGELOG.md` plus the next GitHub Release notes.
- Emergency release rights are scoped to OmniCore packages and may be revoked by a later 75% maintainer vote if the incident is resolved or abuse is confirmed.

## Escalation

If a release blocks production users, maintainers may cut a hotfix branch from the latest tagged release. Hotfixes must still pass contract tests and benchmark gates before publishing.
