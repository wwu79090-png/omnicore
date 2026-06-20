# OmniCore 2.5D Enhancements

OmniCore keeps the runtime 2D/2.5D-first. These modules extend existing systems without adding an external engine dependency.

## Heightfield NavMesh

`HeightfieldNavMesh25D` stores a grid of cells with `x`, `y`, `z`, `walkable`, and optional `slope`. `findPath(start, goal)` returns waypoints with an `action` field:

- `walk`: same-height or gentle slope movement.
- `jump`: height delta is within `jumpHeight`.
- blocked cells are skipped and the graph routes around them.

The class implements the same `worldToCell`, `cellToWorld`, and `findPath` contract used by `NavigationAgent2D`.

## Spatial Audio

`AudioManager.createSpatial25DProfile()` computes gain, pan, low-pass cutoff, and reverb bias from listener/source positions. Z depth increases distance attenuation, wall occlusion lowers the low-pass cutoff, and vertical separation increases reverb bias.

## Particle Terrain Collision

`ParticleTerrainCollider25D` samples terrain height at the projected particle position. When a particle crosses the height plane it applies restitution for bounce and friction for sliding.

## Volumetric Fog And Light Scattering

`Light2D.createVolumetricFogLayer()` emits renderer commands for a fog pass, light scattering pass, and rim-light pass. It remains a descriptor layer so Pixi/WebGPU backends can consume it without changing the public `Light2D` API.

## AI 2.5D Level Generation

`AIImporter.generate25DLevel()` consumes 2D boundary polygons such as rivers and forests and produces decorative 3D asset descriptors, projected shadows, z-sorted entities, and occlusion depth records.

## Performance Notes

All five modules use bounded arrays, grid sampling, and descriptor outputs. They avoid per-frame allocations where possible and are designed to stay within a 60fps browser frame budget when used with chunked terrain and capped particle counts.
