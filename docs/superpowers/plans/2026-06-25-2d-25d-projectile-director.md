# 2D/2.5D Projectile Director Hardening

## Goal

Strengthen OmniCore's 2D/2.5D gameplay stack with a production-oriented projectile director that can drive bullets, magic bolts, thrown objects, traps, and editor playtest debugging.

## Scope

- Add `Projectile2D25DDirector` to coordinate emitter firing, projectile motion, target collisions, pierce, bounce, despawn, pooling, impact feedback, debug draw commands, editor panels, and runtime sync payloads.
- Export the schema and factory from the public runtime entrypoint.
- Wire the official `examples/2d-25d-platformer-demo` so it demonstrates projectile firing, pool telemetry, pierce/bounce behavior, and overlay/debug visibility.
- Add focused Vitest coverage for the runtime contract and demo wiring.
- Refresh generated API docs and public API contract snapshots.

## Validation

- `npm test -- tests/projectile-2d-25d-director.test.js`
- Focused 2D/2.5D gameplay regression tests.
- `npm run lint`
- `npm run build`
- `npm run docs:generate`
- `npm test -- tests/contract/api-contract-snapshot.test.js`
