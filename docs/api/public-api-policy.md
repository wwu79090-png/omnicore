# OmniCore Public API Policy

OmniCore keeps the broad `src/index.js` export surface for backwards compatibility, but release decisions use three API tiers.

## Stable Runtime APIs

Stable APIs are covered by contract snapshots and should not break without a deprecation window:

- `Game`, `Scene`, `Sprite`, `Tween`, `Camera`, `Timer`
- `Loader`, `AssetLoader`, `Store`, `EventBus`
- `Tilemap`, `EventSheet`, `Prefab`, `Database`
- `Backend`, `RendererManager`, `PixiRenderer`
- `createLeanRuntime` and the `omnicore/lean` export

## Experimental APIs

Experimental APIs can change between minor versions. They must stay documented as experimental until production examples and platform smoke tests cover them:

- WebGPU renderer and worker bridge
- Microkernel bridge and addon lifecycle bridge
- Editor live sync, editor panels, and desktop packaging helpers
- AI importer, hotfix manager, marketplace server, and commercial adapters
- Decorative `Dimension3D`

## Internal Or Compatibility APIs

Internal or compatibility exports should not be promoted in tutorials. They stay exported only to avoid breaking older examples or generated docs.

## Release Rules

- Any new stable export must update `tests/contract/golden/omnicore-core-api.json`.
- Any public/experimental/internal tier change must update `docs/api/api-surface.json`.
- `npm run audit:api-surface` runs in PR CI and blocks removed or demoted stable APIs unless a migration note is supplied through `OMNICORE_API_MIGRATION_NOTE`.
- Breaking stable API changes require a deprecation entry and migration note.
- Experimental exports can change, but release notes must call out the change.
- New tutorials should import from the narrowest available entry point, usually `omnicore`, `omnicore/core`, or `omnicore/lean`.
