# Static render packets and shared garden materials

Static terrain chunks used to submit one draw per component and chunk. Each
component also cloned its own material, so equal terrain materials could not
share a draw or a program instance. `StaticRenderPacketBatchProvider` in
`EntityInstances` collects the stable merged chunks of every participating
component and compiles the compatible ones into one chunk render packet.

## Material families

`classifyGardenMaterial` sorts a stable chunk's material into one of three
families:

- **Opaque**: single, non-transparent material with no `alphaTest`. Batched.
- **Cutout**: single, non-transparent material with `alphaTest > 0`. Batched.
- **Transparent**: depends on per-object sorting. Stays on its existing path.

`getGardenMaterialSignature` describes a material by its type, every
serializable own property (colors, roughness, metalness, emissive, side, alpha,
depth/blend state, texture UUIDs, and so on), and its shader hooks. Equal
signatures render identically. A material with unknown objects, user data,
clipping planes, or unregistered `onBeforeCompile` hooks has no signature and
batches only by identity. The scene-owned cloud-shadow decorator does not count,
because the cloud layer applies it to whichever shared instance is rendered.

Shader decorators that are pure functions of their configuration register that
configuration with `registerGardenMaterialShaderHooks`. Ground patches do this,
so two `dirt` patches of equal source materials share one instance, while
`dirt`, `grass`, and different wet patches stay separate.

`useSharedGardenMaterial` resolves a participating material to the first live
material with the same signature. The registry never creates or disposes
materials. Ownership stays with the component that made the material, and the
canonical entry is dropped when its last user releases it.

## Packet planning

A contribution is one component's stable instances of one geometry in one
8-unit chunk. `planStaticRenderPackets` joins contributions only when all of the
following match:

- chunk;
- static-cache group;
- canonical material instance;
- `castShadow` and `receiveShadow`;
- `renderOrder`;
- vertex layout. Attribute names, array types, item sizes, normalization,
  half-float storage, GPU type, morph targets, and indexing must all be equal.

Contributions keep owner-and-chunk IDs, and a packet orders its sources by those
IDs. A packet with an unchanged contribution list keeps its object and source
list. Untouched chunks therefore keep their compiled buffers when another chunk
changes. `MeshCompiler` jobs accept several sources. `compileMeshBufferSources`
transforms each source and then concatenates them, rebasing indices and moving
to 32-bit indices only when the joined packet needs them. The small synchronous
path, the worker path, cancellation, and the instanced fallback for pending or
failed compiles work as they did for single-geometry chunks.

Each static-cache group gets one `StaticOpaqueSceneCacheBoundary`, and every
packet in the group counts as one submission. Packets render in the provider's
coordinate space. Only `renderStableChunksAsMergedGeometry` participants opt in,
and all of them render garden-space instances.

## Fallbacks

These components keep their per-component merged chunks unchanged:

- **`weather-integrated`**: base-ground surfaces that swap to an integrated
  rain/snow material. Batching them would split packets and recompile every
  time the weather changes.
- **`material-node`**: JSX material children.
- **`material-array`**, **`missing-material`**, and **`transparent`**.

Placement-drop animations, pickup outlines, and rain/snow overlays still use
each component's own paths. Interaction comes from the spatial index, not from
raycasts against terrain meshes, so it does not change.

## Diagnostics

`window.__grediceGameProfile.renderPackets` reports:

- packet and contribution counts;
- saved submissions (`contributions - packets`);
- opaque and cutout packet counts;
- distinct packet materials;
- packet compiles and their maximum duration;
- live instanced fallback meshes;
- fallback component counts by reason.

`window.__grediceGameProfile.gardenMaterials` reports:

- canonical material count;
- shared users;
- deduplicated users;
- identity-only users.

## Not yet covered

The following parts of #4721 are not done:

- Merging materials that differ only in palette values. This would need
  per-vertex color, roughness, metalness, or emissive data in a shared shader.
- Batching weather-integrated surfaces, which would need shared integrated
  weather materials.
- Batching transparent effects.

Production cross-tier profiles, GPU timing, and deterministic visual captures
have not been run for this change.
