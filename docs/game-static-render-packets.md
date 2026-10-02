# Static render packets and shared garden materials

Static terrain chunks used to submit one draw per component and chunk. Each
component also cloned its own material, so terrain materials could not share
a draw even when only palette/PBR values differed. `StaticRenderPacketBatchProvider` in
`EntityInstances` collects the stable merged chunks of every participating
component and compiles the compatible ones into one chunk render packet.

The production GLTF and additional rigid-prop callers opt in with
`batchStaticMaterial`; declared static cache groups also qualify. This admits
compatible stable opaque/cutout props even when their old per-component
`renderStableChunksAsMergedGeometry` flag is absent. Generic callers keep their
existing path: an unrelated autumn leaf material that changes PBR values in an
effect, for example, is not opted in. Eligible geometry is immutable or replaced
by a new source object; any writer must publish attribute `needsUpdate` versions
before using the compiler's versioned-source cache.

Simple intrinsic `<meshStandardMaterial>` nodes can qualify with supported
scalar/Color constructor props. Their concrete source materials are created in
layout-effect leases, disposed on cleanup, and freshly allocated after
StrictMode replay. Refs, constructor `args`, children, maps, custom hooks and
unknown JSX components stay on the authored path. Placement/drag meshes and
pickup outlines retain source geometry and JSX; only stable instances join
packets.

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
source materials. Ownership stays with the component that made the material, and the
canonical entry is dropped when its last user releases it.

`useGardenPalettePacketSource` migrates compatible `MeshStandardMaterial`
sources to one generated shared shader. Color, roughness, metalness, and
emissive multiplied by emissive intensity are stored in two constant `vec4`
attributes per source vertex. They survive retained-chunk transforms and
concatenation, so different palettes share one packet without changing their
linear PBR inputs. Existing vertex color and texture maps still multiply the
same inputs. Alpha maps, cutout thresholds, side, depth and shadow settings
remain on the original built-in shader path.

All remaining properties and registered hook settings stay in the compatibility
signature. Unknown shaders, physical-material extensions, clipping planes and
unregistered user data retain their existing material path. Generated shaders
are owned by the registry and disposed only after their last user releases.
Prepared source geometry is copied and disposed independently of GLTF geometry,
placement animations and outlines.

Integrated weather materials register their exact settings and the identities
of their mutable rain, frost and snow uniforms. Equal values with independent
uniform owners cannot share. Palette tint runs before ground patches and
weather blending; authored snow-local attributes survive compilation. Weather
surfaces can therefore join compatible packets, while their moving shaders
remain live at the cache boundary. Static palette shaders retain opaque cache
eligibility.

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

While compilation is pending, each contribution renders its authored stable
geometry with the same instance transforms. Eligible palette sources use
commit-owned transient material clones with identical PBR values, maps, cutout,
ground callbacks and live weather uniform owners. The scene applies cloud
attenuation once to each clone. Pending meshes wait for their clone lease;
borrowed original materials never reach a pending frame. The final fallback
consumer disposes the clone and its unused instancing programs when compilation
finishes or the component releases. The palette shader is only used for the
final non-instanced packet. Unknown hooks retain their authored lifetime, and
fallback never disposes source geometry, source materials or their textures.

Each static-cache group gets one `StaticOpaqueSceneCacheBoundary`, and every
packet in the group counts as one submission. Packets render in the provider's
coordinate space. Explicit merged-terrain participants and compatible opted-in
rigid props all render garden-space instances. Empty placement members stay in
packet telemetry so dropping a contributor's last stable instance and rejoining
it can still identify a completed physical rebuild; empty members never enter
compiler sources, rendered contribution counts or saved-submission estimates.
If an entire packet disappears there is no rebuild to time; its later recreation
is a new compile, visible in general compiler counters.

## Fallbacks

These components keep their per-component merged chunks unchanged:

- **`material-node`**: unsupported JSX material children.
- **`material-array`**, **`missing-material`**, and **`transparent`**.

Transparent effects, including additive effects, retain per-object sorting
against other alpha effects and weather. Additive contributions commute with
each other, but moving their draw order relative to ordinary transparency can
change the combined result, so they are not merged without an isolated-layer
visual parity witness.

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

Production cross-tier profiles, GPU timing, and deterministic visual captures
are required before accepting a performance improvement. Transparent effects
remain on the safe fallback path until their own overlap comparisons establish
an ordering-preserving batching strategy.

The deterministic `GardenPalettePacketFixture` and
`apps/garden/tests/garden-palette-packets.spec.tsx` compare authored and palette
shaders with identical compiled transforms under day/night lighting and clear/rain/snow/combined
weather. They include mapped PBR inputs, vertex colors, cutout shadows,
foreground depth occlusion, in-place palette mutation, StrictMode mounting and
last-user disposal/remount. PNGs and numeric difference diagnostics are attached
to each browser test result; this fixture proves visual parity, not device GPU
savings.

`GardenPaletteAdmissionFixture` exercises the actual `EntityInstancesGeometry`
production path with GLTF-style materials and authored material nodes. It starts
with batching enabled under StrictMode, then compares source and packet pixels,
unchanged triangles and raycast hits, six contributions sharing two spatial
packets, a local membership patch retaining the other chunk's geometry, palette
mutation, an unknown-hook fallback, and final release/remount. Shared packet
compilation also publishes physical placement rebuild timing and transformed
instance counts when placement membership changes. A deliberately large source
forces real worker compilation and visible pending frames; those frames contain
only transient authored shader clones, and every observed clone is disposed
after readiness and final release.

A separate diagnostic comparison of an uncompiled authored mesh against its
compiled palette mesh found 378 of 196,608 pixels (0.1923%) differing by more
than two channel values, with a maximum channel difference of 8/255. The
differences were confined to the rain-only frost grain on ground tops. Baking
world transforms to Float32 geometry changes the high-frequency world-noise
rounding relative to a shader-applied model matrix. Existing stable weather
chunks already use compiled transforms; the palette parity fixture uses that
same production transform path on both sides and keeps its original thresholds.
