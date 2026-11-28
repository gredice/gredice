# Game Art Guide

Use this guide for anything that renders inside the 3D garden: models,
materials, colours, lighting, motion and generated block images.
[DESIGN.md](./DESIGN.md) still covers HUD layout and 2D interface work.

## Status

Proposed 2026-11-22. Since 2026-11-23 the catalogue and the renderer follow
this guide on the `design/party-game-style` branch: every model in
`assets/game-assets.json`, the light for every time of day and weather,
contact shadows, motion, water, crops and the seasonal colours. The audit,
what is implemented, the remaining gaps and the open art decisions are in
[docs/game-party-style.md](./docs/game-party-style.md).

`assets/scripts/generate-party-core.py` and the
`assets/scripts/party-pass-*.py` scripts are the sources of the restyled
models: their shapes, bevel sizes and colours. They share the helpers and
role colours in `assets/scripts/party_style.py`. The 17 animals come from
`assets/scripts/party-animals.py`, which rebuilds them to [Animals](#animals);
`party-pass-animals.py` now restyles only the farmer avatar.

Since 2026-11-24 the renderer also follows [Weather](#weather): one weather
system, mounted from `packages/game/src/scene/weather/WeatherLayers.tsx`,
draws every state. The old cloud billboards and shadow mask, the old rain
streaks, the grey morning-mist wisps, the wet overlay copies (per prop and
instanced on blocks), the lightning light flash and the
`weatherStyle=legacy` switch are retired.
What is still open is listed under "Not done yet" in
[docs/game-party-style.md](./docs/game-party-style.md).

## The look

A sunny toy diorama. Chunky rounded objects in clean saturated colours with
painted textures, on one continuous floor, lit warm from one side with cool
shadows, that bounce a little when touched. The
reference is the toy-like look of modern party board games such as Super Mario
Party Jamboree.

- Borrow rendering principles only. Never copy that game's characters, logos,
  board spaces, interface motifs, sounds or specific props.
- Gredice shows a real garden. Stylise a tomato plant's shape and colour, but
  it must still read as a tomato plant.

## Shape

One tile is one unit. The default camera zoom is 100 pixels per unit.

- Bevel every edge the camera can see. Nothing keeps a 90° edge.

  | Part | Bevel radius |
  | --- | --- |
  | Terrain caps and large masses | 0.06 to 0.08 |
  | Timber, posts, crates, most props | 0.035 to 0.055 |
  | Parts smaller than 0.15 units | 0.015 to 0.03 |

- Shade smooth, with weighted normals on bevelled boxes. Faceted low-poly
  shading is retired.
- Build each object from a few large masses: rounded boxes, spheres, capsules.
  Aim for six or fewer on a 1×1 prop.
- Prefer one soft form over a cluster of spheres. A tree or bush canopy is a
  single rounded dome with at most one lighter cap, not a bunch of balls.
- Parts that meet should not cut through each other. Planks stop at a post
  and sit slightly back from its face.
- Make it chunky. Thicken thin parts by about 1.5×, enlarge heads, fruit and
  flowers by 1.2× to 1.4×, and shorten tall thin shapes.
- No visible part is thinner than 0.03 units, which is 3 pixels at the default
  zoom. Structural timber is at least 0.12 thick.
- Model the large detail: a plank gap, a lip, a cap. Paint the small detail:
  grain, blades, pebbles. See [Textures](#textures).
- Check the silhouette at the far zoom of 75 and in all four rotations.
- Footprint, pivot and object names do not change when an asset is reshaped.
  Keep a 1×1 prop inside 0.9×0.9 units, as in
  [docs/autumn-art-direction-2026.md](./docs/autumn-art-direction-2026.md).

## Terrain

- The floor reads as one continuous surface. Adjacent blocks at the same
  height show no bevel, gap, outline or alternating tone between them.
- Only exposed edges are shaped: the outer rim and height steps get the 0.06
  to 0.08 bevel and show the soil body underneath. The cap overhangs the soil
  by 0.03 to 0.04 units. Ramps, corners and stairs get the same edge: it
  follows the slope down their sides. Where a neighbouring slope rises to
  meet it, a grass, soil or sand edge tapers away and a stone or gravel edge
  keeps its size and sinks into the slope; it never ends in a point. A
  stair's upper step ends its edge flush with the riser. A soil, sand or
  grass ramp or corner takes the weather of the flat block it continues: in
  rain it is as wet as the ground and the lip beside it.
- A dragged block looks like a placed one (user feedback 2026-11-26). A
  terrain block picked up or dragged in from the HUD wears the same lip and
  soil or stone body, rimmed on every side as its own small island, and the
  hole it leaves gets walls like a real gap
  (`entities/terrainRim/terrainRimDragPlacements.ts`).
- Where lawn meets a path, the grass forms a low raised bank (about 0.03
  high) that rolls onto the path along an edge that wanders instead of
  following the grid.
- Ground textures are projected in world space so they line up across blocks.

## Water

Built 2026-11-26 (user request: waterfalls on the edges of water blocks).

- Water is lit and opaque, in the water role, with a rounded foamy lip on
  every exposed top edge.
- Every exposed side is a waterfall: the lip foams, soft light streaks slide
  down the wall and the water churns white where it lands. A side next to
  water or terrain as high as the water stays still.
- A fall lands on the highest surface below it: a block top, a ramp's slope
  or toe, a stair step or lower water, with a scalloped foam skirt and a
  rolling ring on the landing. Water standing on a taller block pours over
  that block's grass lip first, so the lip never cuts the fall. Water
  stacked above the ramp or corner it fills pours over the ramp's crest and
  slopes the same way, never behind its soil. Off the island edge the fall
  carries on past the island base and fades into a little mist.
- Water never freezes, so falls keep flowing in winter. Once the quality
  tier draws snow on the grass, landing foam on terrain melts away and a
  spill lifts over the snow on its lip; on bare grass neither happens.
- The motion rides the water surface's scene-time lease, holds still under
  reduced motion and fixed time, and the low tier drops the second noise
  octave, the foam ring and the mist.
- Code: `packages/game/src/entities/waterfall/` and the waterfall parts of
  `entities/waterBlockMaterial.ts`. Details are in
  [docs/game-party-style.md](./docs/game-party-style.md), the render cost
  in [docs/game-scene-performance.md](./docs/game-scene-performance.md).

## Colour

- Choose colours by how they look on screen. The scene lights a sunlit top
  face to about 3.2 times its albedo, so the albedo you author is darker than
  the colour players see. `screen_to_albedo` in `assets/scripts/party_style.py`
  converts an on-screen target to the albedo to author, and `PALETTE` in
  `assets/scripts/generate-party-core.py` lists the core albedos next to their
  targets.
- On screen, main surfaces have saturation 0.55 to 0.85 and value 0.7 to 0.95
  (HSV).
- Neutrals such as stone and white paint: saturation 0.10 to 0.25 with a cool
  or warm tint. Never pure grey, pure white or pure black.
- The darkest on-screen colour is rich soil at a value of about 0.55. Darkness
  comes from shadow, not from colour.
- Greens lean yellow. No olive.
- Each prop uses one dominant colour, one secondary and one small accent.
- Do not paint shading, highlights or ambient occlusion into colour.

Colour roles, as the sRGB colour a sunlit face shows on screen:

| Role | On screen | Roughness |
| --- | --- | --- |
| Grass | `#7bd03a` | 0.7 |
| Path | `#e0a765` | 0.8 |
| Terrain soil body | `#b9693a` | 0.8 |
| Bed soil | `#8f5530` | 0.85 |
| Timber, light and dark | `#f2a53a`, `#dc8427` | 0.55 |
| Trunk | `#b56a3c` | 0.6 |
| Canopy, base and highlight | `#43b93a`, `#6fd040` | 0.55 |
| Moss | `#78cc58` | 0.6 |
| End grain | `#f2c674` | 0.6 |
| Crop leaf, base and highlight | `#5fc93a`, `#a4e352` | 0.5 |
| Stone | `#b3bdd3` | 0.6 |
| Steel, tinted blue | `#8fc0ee` | 0.3 |
| Water | `#35b4ff` | 0.12 |
| Ripe red | `#f23b2c` | 0.25 |
| Carrot orange | `#ff8a1c` | 0.4 |
| Sunflower petal, light and shade | `#ffd31c`, `#ffb300` | 0.45 |

These are the values used in the example scene. Extend the table when a new
role is needed instead of inventing a one-off colour.

Moss is softer and lighter than the canopy, so a moss cushion reads apart
from leaves and lawn. End grain is the cut face of a round log, with nut
caramel rings: paler than the timber roles, so it reads as fresh wood rather
than orange, and saturated enough to stay warm under the shade veil, where
cream turns lilac. Split firewood keeps the timber roles.

### Seasonal roles

Seasonal and holiday colours use these roles, decided 2026-11-23. They follow
the same rules as the base roles: seasons change hue, not brightness or
saturation. `SEASONAL_ROLES` in `assets/scripts/party_style.py` and
`packages/game/src/scene/seasonalRoles.ts` hold the same values with the
albedo to author, and `AUTUMN_REMAP` and `SEASONAL_REMAP` in
`party_style.py` map every old seasonal colour to a role.

| Season | Role | On screen | Roughness | Use |
| --- | --- | --- | --- | --- |
| Autumn | Canopy gold, amber, orange, red | `#f0c832`, `#f09a38`, `#ee6c2b`, `#e44a2e` | 0.55 | Deciduous canopies and loose leaves, in this order after the summer green. Red replaces the old russet brown. |
| Autumn | Leaf pile | `#d9733a` | 0.6 | Body of a leaf pile or leaf bed, under leaves in the four canopy colours |
| Autumn | Pumpkin, light and shade | `#f0803a`, `#f2a640`, `#e2662a` | 0.4 | Pumpkins and squash, also for Halloween |
| Autumn | Hay, base and shade | `#f2cb5a`, `#dcab48` | 0.8 | Hay, straw, dry grass, seed heads, wicker |
| Autumn | Apple red | `#ec3c3a` | 0.3 | Harvest apples |
| Autumn | Nut caramel, acorn cap, conker | `#dc9a4c`, `#c28a50`, `#c4683a` | 0.45, 0.6, 0.35 | Acorns, chestnuts, conkers, mushroom caps, hedgehog |
| Autumn | Terracotta | `#e4764a` | 0.4 | Seasonal terracotta pots |
| Autumn | Aster violet | `#c05ddc` | 0.6 | Asters and other autumn flowers |
| Autumn | Textile rust | `#e45f3a` | 0.8 | Blanket stripes, patches, bunting |
| Autumn | Cream (neutral) | `#f2e4c6` | 0.8 | Linen, paper, mushroom stems, ribbons |
| Autumn | Enamel blue | `#3f8ff0` | 0.35 | The cool accent next to warm props: enamel, a work shirt |
| Autumn | Iron (neutral) | `#8a95b5` | 0.4 | Dark metal: rake heads, pans, wheels, braziers |
| Autumn | Lantern glow | `#f2b84a`, emissive `#ffb43a` | 0.5 | Lanterns, embers, pumpkin lanterns |
| Halloween | Purple, lime | `#9a4ce0`, `#b4e22e` | 0.4, 0.45 | Halloween accents, beside the pumpkin roles |
| Halloween | Ghost lilac (neutral) | `#e2d4f2` | 0.75 | Ghost sheet, cobweb |
| Any | Ink violet | `#5c4590` | 0.5 (animal eyes 0.35) | Small facial features only: eyes, smiles, snowman coal. Never black. Animal eyes, nostrils and smiles share the glossy eye material ([Animals](#animals)). |
| Winter | Snow (neutral) | `#d6e2f2` | 0.8 | Snow cover, snow blocks, snowman |
| Winter | Ice blue | `#6ac6f0` | 0.15 | Ice, icicles |
| Winter | Evergreen | `#42b848` | 0.55 | Pine and fir needles, wreath greenery |
| Winter | Holiday red, gold | `#dc2f4c`, `#f2c040` | 0.35 | Gift boxes, ribbons, ornaments, stars |
| Winter | Warm lamp | `#f2cc66`, emissive `#ffd36b` | 0.5 | Fairy lights, winter lamps |
| Spring | Spring green | `#8ee04e` | 0.5 | Fresh leaves and buds |
| Spring | Blossom pink, blossom white (neutral) | `#f26aaf`, `#f2d4e2` | 0.5 | Blossom |

Summer uses the base roles. Wood keeps its shared wood profiles in every
season. The two glow roles give the colour the glowing part shows by day and,
separately, its emissive colour.

Timber in the game uses a few shared wood profiles: the default plank
(`Material.WoodenWalkway.WarmWood`), three bridge woods and the dog house's
own tones. `assets/apply-bridge-wood-palette.py` keeps them in sync and
`timberAssetPalette.unit.ts` checks them. The default plank sits between the
old red-brown and the timber row above. Change a profile as a whole, never
per prop.

## Textures

- Use textures sparingly, and only where a flat colour looks empty: soil,
  paths, wood, bark and stone. Grass stays close to flat, with soft tonal
  patches at most. Tree and bush canopies, crops, steel, enamel, fruit, petals
  and water stay flat colour.
- A texture should read as a slightly richer version of the flat colour, not
  as a pattern. Busy marks such as individual grass blades or leaf shapes were
  tried and rejected.
- Paint them, do not photograph them. Use two or three close tones around the
  role colour and large soft shapes: broad patches, gentle layers, a few grain
  lines. No noise, no speckle, no photo sources.
- Generate them with the image model and keep the prompts. The current set and
  its prompts are in `assets/game-textures`.
- A mark may carry a small highlight and shade from the upper left. Nothing
  larger than a mark is shaded, and no shadow or ambient occlusion is baked.
- Keep texture quieter than lighting. The lightest and darkest tone stay
  within about 15% of the role colour in value, so the three lit values of a
  block still read first.
- Shapes are at least 0.1 units across. Smaller ones turn into noise at game
  scale.
- Textures tile, at about 256 pixels per unit. Ground textures cover 2×2 units
  so repetition is hard to spot.
- Direction follows the object: grain along a plank, bark up a trunk, grass
  blades pointing up the screen.
- One shared texture per role, reused by every asset. Do not add a texture for
  a single prop.
- Where code changes the colour (seasonal foliage, colour variants of one
  prop), author the texture as light and dark variation that multiplies the
  role colour, so the colour stays controllable.

## Materials

- Metalness is 0 on everything. The scene has no detailed environment to
  reflect, so metalness only darkens colour. Metal reads through a light, cool
  albedo and low roughness.
- Roughness by band:

  | Band | Roughness | Use |
  | --- | --- | --- |
  | Matte | 0.75 to 0.85 | Soil, terrain, fabric, rope |
  | Satin | 0.5 to 0.6 | Wood, leaves, painted surfaces, stone |
  | Gloss | 0.25 to 0.45 | Fruit, enamel, glazed pots, steel |
  | Wet | 0.1 to 0.2 | Water, glass |

- One material per colour role. Reuse shared names such as `Material.Planks`
  so a palette or texture change is one edit.
- Flat-colour roles use base colour factors, not textures.
- Emissive is for lamps and flames only.

## Lighting and rendering

Scene code owns these. Assets must not compensate for them.

- Neutral tone mapping at exposure 1.
- At midday every block shows three clearly different values: the sunlit top,
  a lit side at about 0.6 of it, and a shaded side at about 0.4 of it, tinted
  cool.
- One warm key light, a hemisphere fill with a cool sky and warm ground
  bounce, and a small cool ambient fill. No flat white ambient light. The
  values are in `packages/game/src/scene/gameArtStyle.ts`, one set per time
  of day, applied by `scene/atmosphereLighting.ts`.
- The key always comes from the camera's side of the garden, high enough to
  light the tops and low enough to light one side, even under a summer noon
  sun. A sun or moon behind the garden is mirrored to the front, so one
  visible side stays lit and shadows fall away from the camera. The key
  follows the camera itself, not the stored rotation.
- Flat faces under an orthographic camera show one flat colour, so form has to
  come from bevels. A shared sky rim (`scene/skyRimShaderChunk.ts`) lights the
  edges of rounded surfaces, and a subtle height gradient
  (`scene/surfaceGradientShaderChunk.ts`) lights the sides of props a little
  darker and cooler near the floor and lighter toward the top. It leaves
  up-facing faces and the bottom layer of terrain alone, so the floor stays
  continuous. The sides of raised terrain steps take a little of it.
- Light alone cannot turn a green or orange surface blue-violet without
  darkening it. The same chunk adds a shade veil (`gameShadeVeil`) to faces
  the key does not reach: it cools and lifts their fill and adds a little
  periwinkle. By day it is light, so shadows on sand read lilac grey instead
  of olive. At night it is stronger, so shaded sides and cast shadows read
  blue-violet while sunlit tops and emissive glow keep their colour. It
  switches off under the even light of cloud and fog. The night key is about
  half the midday key, so tops sit at about 0.8 of their midday value.
- Shadows are soft, tinted blue by the fill, and never black.
- Every standing object has a soft contact shadow, including on the quality
  tier without shadow maps.
- Every time of day stays light and colourful. Dawn, sunrise, morning,
  sunset, dusk and night are brighter versions of their mood, never dark,
  murky or grey. See [Time of day and seasons](#time-of-day-and-seasons).
- Overcast, rain, snow and fog keep their saturation and stay light. They
  shift toward blue-violet; they do not go grey. The one exception is the
  backdrop behind the island, which goes a soft grey under high cover with
  rain or storm (see [Clouds and overcast](#clouds-and-overcast)).
- No post-processing pass is required for the look.

## Time of day and seasons

Decided 2026-11-23: every season and every time of day gets the bright party
look. Nothing is a muted exception.

- Night is a light, saturated blue-violet, like a party board at night, not
  a dark scene. Every block, colour and silhouette still reads, and a grass
  top still looks green. Lamps, lanterns and other emissives glow clearly
  against it.
- Sunrise and sunset glow warm peach, coral and gold. Dusk turns lilac.
  Morning is fresh and clear. None of them dims the scene much below midday.
- Shadows at every time of day stay soft and tinted, never black.
- Seasons change hue, not brightness or saturation. Autumn is clear orange,
  red and gold. Winter is clean blue-white snow with warm accents. Spring is
  fresh light green with blossom pinks. Summer is the base palette.
- In winter the round tree is bare: branches only, no crown ball, and lying
  snow settles as thin lines on the branches (see [Snow](#snow)).
- Seasonal and holiday collections (autumn, harvest, Halloween, winter)
  follow the same colour, roughness and metalness rules as everything else.
  They take their colours from the seasonal roles in
  [Colour](#colour), not from the muted palette that
  [docs/autumn-art-direction-2026.md](./docs/autumn-art-direction-2026.md)
  described before.
- Check every change at dawn, midday, dusk and night, and in each season.

## Weather

Proposed and built 2026-11-24. Weather is part of the toy diorama: chunky, rounded,
smooth-shaded props in clean saturated colours that read at a glance, never
a grey filter over the garden. The shapes come from the team's weather icons
(`packages/ui/src/GameIcons/assets/` and
`packages/game/src/hud/components/weather/icons/assets/fog.webp`): a puffy
cloud, a blue teardrop, an ice-blue six-arm snowflake, a yellow zigzag bolt
and rounded fog bands. Take their shapes and colours, not their faceting.

The visual target is
[docs/game-party-style/weather-scene.html](./docs/game-party-style/weather-scene.html)
(`?weather=clear|cloudy|overcast|rain|heavyrain|storm|snow|fog|windy`,
`&time=midday|sunset|night`, `&seed=`, `&t=` to freeze, `&zoom=`,
`&quality=`, `&rm=1`, and buttons for each). Its numbers below are at the
default zoom of 100 on a 1280 × 800 view.

### Three layers

| Layer | What | Size | Where |
| --- | --- | --- | --- |
| Sky props | Clouds and the overcast deck (top band only), sky mist rolls, wind swooshes, the bolt | Pixels: they keep their size when the camera zooms | Clouds in the top band; the rest in free sky (below) |
| Particles | Raindrops, snowflakes | Pixels; their count follows the screen's pixel area | The whole view, depth-tested |
| Ground effects | Cloud shadows, wet look, puddles, splash rings, snow cover, ground mist, rim mist rolls | World units, like the garden | In the garden |

Weather has to read from the ground layer alone: on a farm that fills the
screen there is no free sky, so shadows, drops, rings, puddles, the wet
look, mist and snow cover carry the state.

- **Free sky.** The garden footprint is the on-screen silhouette of the
  terrain and every standing object (from the stacks: block positions and
  heights). Standing objects are soft forms: full width to 70% of their
  height, half width at the top, not boxes. The terrain is raised by an
  animal's height (a cow 1.4 units) only on tiles within its day range of
  its home block, so a garden without roaming animals keeps its real
  silhouette. A sky prop keeps 14 px plus its own drift clear of the
  footprint and of other sky props, placed in order: the band, the bolts,
  the sky mist rolls, then the swooshes. It may be cut by a side or the
  bottom edge by up to a quarter of its size, never by the top edge. A slot
  that overlaps the footprint moves outward from the view centre; if no free
  sky is left the prop is not drawn (the bolt falls back to its short 96 px
  form, see [Storm and lightning](#storm-and-lightning)). Recompute on every
  pan, zoom, rotation and resize.
- **The cloud band.** All clouds live in the band across the top of the
  view (top 30%, up to 35% under full cover; see
  [Clouds and overcast](#clouds-and-overcast)). It is the only sky prop
  allowed over the garden, and there only by 10% of the view height at
  most, at half opacity. Its lower edge is set per screen column (the band
  share, or 10% of the view height below the garden's top in that column,
  whichever is higher), then smoothed. Clouds are never placed beside or
  below the island. Swooshes and sky mist rolls keep to the free sky below
  the band; the bolt hangs from the deck's lower edge.
- No sky prop crosses a raised bed, plant, animal or item. Clouds drift
  sideways through the band at their own speeds and wrap around off-screen;
  they never leave the band.
- Sky props and the band are off in the third- and first-person avatar
  views. Particles and ground effects stay.

### Colour roles

Weather props are unlit: the shader writes the colour below and takes no
scene light, so weather stays light at every light level and never changes
the static cache's lighting. They need no albedo (`screen_to_albedo` is not
used). Each role has a value per time of day; dawn and dusk blend the
neighbouring sets like the light frames do. Bolt and storm values are the
same at every time unless listed.

| Role | Midday | Sunset | Night |
| --- | --- | --- | --- |
| Cloud fair, lit and shade | `#f8f6ff`, `#c4cbf5` | `#ffeee2`, `#d7abd8` | `#cbcaf8`, `#8f92de` |
| Cloud overcast | `#eceafd`, `#a6acec` | `#f6e4ee`, `#b8a0dc` | `#c6c2f4`, `#8a86d8` |
| Cloud rain | `#e4e6fd`, `#9ca6ea` | `#efe0f0`, `#aa9cdc` | `#c0c0f4`, `#8488da` |
| Cloud storm (violet) | `#ddd6fb`, `#968ce2` | `#e8d8f4`, `#9e88d8` | `#bcb2f2`, `#7e72d2` |
| Cloud snow | `#f2f5ff`, `#b6c4f2` | `#fbeef4`, `#c8b2e2` | `#d4d6fa`, `#9aa2e6` |
| Cloud rim | `#fbfaff` | `#fff6ea` | `#e2e2ff` |
| Storm sky, top to bottom | `#8a84de`, `#aca6ee`, `#dcd4f8` | `#8e82d6`, `#b49ad2`, `#e8c8cc` | `#574bb6`, `#6a62c8`, `#887ed4` |
| Cloud shadow tint (multiplies light) | `#c3c9f8` | `#d4c2f2` | `#c2c4f6` |
| Mist and mist low | `#e3defc`, `#c4c2f4` | `#f8dcea`, `#e6c4dc` | `#b2b0f0`, `#9796e2` |
| Raindrop leading end and body | `#a2dcff`, `#2f9aff` | `#b4d4ff`, `#4f94f8` | `#e0f2ff`, `#a8dcff` |
| Splash ring and ring edge | `#f2faff`, `#4fb2ff` | `#fff6f6`, `#6aa6ff` | `#e4f2ff`, `#9ed2ff` |
| Puddle deep and light | `#5ab8ff`, `#bfe6ff` | `#8f9ff0`, `#f6d2dc` | `#7d84e4`, `#c6ccff` |
| Flake core and edge | `#fbfcff`, `#b4cbf6` | `#fff8f4`, `#d2bfee` | `#f2f3ff`, `#a6b0f0` |
| Icon flake face, rim, glint | `#8fd6fa`, `#4aa6ee`, `#e2f6ff` | `#9cd4fa`, `#6a9cee`, `#f4f0ff` | `#a6dcff`, `#6c8cec`, `#eef6ff` |
| Wind swoosh | `#fbfcff` | `#fff8f2` | `#dcdeff` |
| Bolt face, side, light | `#ffd31c`, `#ffb300`, `#fff3a6` | same | same |
| Bolt glow on its cloud | `#fff2d0` | `#fff2d8` | `#fff2d0` |

- Cloud lit faces may sit at saturation 0.03 to 0.11, below the neutral
  floor, because they are the brightest thing in the sky; the shade side
  carries the colour (0.2 to 0.45). Never `#ffffff`. Mist stays at 0.10 to
  0.35, lilac, never milky white or grey.
- Bolt colours are the sunflower petal roles. Puddles lean on the water
  role. Snow cover stays the winter snow role.

### Clear

- No clouds while cloudy is under 0.05. The sun disc and its glow by day; a
  crescent moon and about 28 small stars at night (2 to 3 px, opacity about
  0.85 on a clear night), hidden as cloud grows (`(1 − cloudy / 0.6)^1.5`).

### Clouds and overcast

User feedback, 2026-11-24: clouds keep the soft, foggy look of the old
clouds, sit only in the top part of the view, look more realistic and vary
more, and full cover is one continuous deck. These rules replace the solid
toy-puff clouds of the first target.

- **Place.** Clouds live only in a sky band across the top of the view:
  the top 30% of the screen height, up to 35% under full cover. Never
  beside or below the island, never in the middle of the view. When the
  garden fills the view, the band may hang over the garden's far edge by
  at most 10% of the view height, and stays translucent there (half
  opacity).
- **Look.** Soft, misty, semi-transparent volumes, like the old cloud
  layer: no hard outline and no toy-icon puff. Body opacity 0.55 to 0.9,
  fading to 0 over the outer 15 to 25% of each cloud. Gentle volume
  shading: lit, light tops, lavender-grey bases, a soft brighter rim toward
  the sun. Realistic cumulus and stratocumulus silhouettes: irregular
  tops, flatter, slightly ragged bases, thin wisps between larger clouds.
  Build them from soft layered lobes or a sky shader with analytic falloff;
  no hand-drawn noise textures. In the game one screen-space shader draws
  every band cloud and the deck from seeded soft lobes in two passes: over
  the sky, and translucent over the garden.
- **Variance.** No two clouds alike: seeded shapes from several lobe
  layouts, width 180 to 520 px, height 0.25 to 0.5 of the width, opacity
  and tone ±10%, different heights inside the band, and drift at 0.6 to
  1.4× the base speed so near and far clouds pass each other. Cap per tier:
  high 10, medium 7, low 4 separate clouds, plus the deck.
- **Cover.** Cloudy under 0.05: none. 0.05 to 0.3: one to three scattered
  clouds. 0.3 to 0.7: more, starting to group. 0.8 and over (overcast):
  one continuous cloud deck across the whole top band, edge to edge with
  no gaps of sky, a soft undulating lower edge, a few brighter and darker
  masses inside it and slow drift. Rain and storm grey the deck as below;
  storm stays a little darker, still light. The sun or moon
  is behind the deck (gone at 0.85) and stars hide. Thunder always brings
  the deck (cover at least 0.86), so the bolt has a lower edge to hang
  from even under little cloud.
- **Haze.** Clouds add a faint haze at the top of the view: up to 10 to
  15% toward the cloud tone at the band, fading to nothing by mid-screen.
  The garden itself stays clear; ground mist belongs to fog.
- **Rain and storm sky.** User feedback 2026-11-26: under high cover with
  rain or storm the backdrop has less colour. The sky gradient and the band
  and deck colours (lit, shade and rim, so the haze too) move toward a soft
  grey at their own luminance, so the sky gets no darker
  (`gameWeatherSkyGrey` in `scene/gameArtStyle.ts`, applied by
  `scene/weather/sky/skyGrey.ts`). The amount is the island's cover curve
  (full from cover 0.75) times the wet amount: rain over 0.2 → 1, or the
  damped storm amount, whichever is more. Rain takes the reported cover, so
  a shower at cover 0.5 keeps most of its colour; a storm takes the cover
  its deck draws (thunder brings the deck at 0.86 or more), so a storm
  reported as partly cloudy greys like an overcast one. Light rain at high
  cover gets part of it, heavy rain and storm all of it. Strength and grey:
  0.8 toward `#d3d7de` at midday, 0.65 toward rose-grey `#dcd5de` at
  sunset, 0.5 toward slate blue `#a9b0d6` at night, so a rainy night still
  reads as night. Clear, partly, dry overcast, fog
  and snow skies are unchanged. The island, its fog colour, the rim mist,
  rain drops and puddles, the bolt and its glow and the avatar views keep
  their colours. The roles table holds the colours before greying.
- **Light on the island follows cover.** User decision 2026-11-25: lower
  cover keeps the island brighter, high cover stays as dark as before. One
  curve gives the share of the cloud, rain and storm light the garden takes
  (`gameWeatherLightRig.coverDimming` in `scene/gameArtStyle.ts`, applied by
  `resolveWeatherCoverDimming` in `scene/atmosphereLighting.ts`): a monotone
  cubic through 0 → 0, 0.2 → 0.03, 0.4 → 0.16, 0.6 → 0.5, 0.66 → 0.6 and
  0.75 → 1. It scales the key loss and fill boost, the lavender fill and
  ground tint, the fade of the key's cast shadows, and the depth fog,
  ground mist, back haze and mist rolls that come with rain, snow or
  thunder (`resolveIslandFoggy`).
- From cover 0.75 up the share is exactly 1, so high cover looks as before,
  the presets' 0.75 (snow) and 0.85 (cloudy, light rain, rain) included.
  The live symbols' 0.66 keeps 60%, 0.6 keeps half and 0.4 about a sixth,
  close to the sunny garden.
- The climb from 0.66 to 0.75 is steep on purpose. A key that has come back
  only in part opens the day shade veil (`gameShadeVeil.keyShareStart` and
  `keyShareEnd`) while the lit sides still get too little direct light to
  stay out of it, so every face takes the veil and orange soil and cream
  walls turn pink. The curve crosses that band between the presets and the
  live covers, never at one.
- Fog that is its own weather holds the share at 1 (fog over 0.15 not
  brought by rain, snow or thunder, fully held from 0.6), so fog and mist
  days do not change. At night the cloud's fill boost stays at every cover
  (`coverDimming.nightFillHold`), so a lower-cover night is never darker
  than a full-cover or clear one; it only gets its key, colour and clarity
  back.
- The sky keeps its own cover rules: the deck, the storm colours, the band
  haze, the bolt and the moving cloud shadows (only the rain and storm grey
  reuses the curve). Thunder still brings the
  deck, so a storm under light cover shows a full deck over a sunny island.
- **Motion.** Clouds and the deck fade and grow in over about 1.5 s
  (250 ms and no drift under reduced motion); no spring pop.
  Each drifts sideways toward the side of the screen the wind blows to
  (more with wind), the same way as the cloud shadows, and changes shape
  very slowly. Overcast must not read as midday: the continuous deck, the
  haze and the moving cloud shadows are all required.

### Cloud shadows

- A separate layer of soft ellipses over the garden, not tied to the
  visible clouds (those sit in the top band and cannot project onto the
  garden). High 6, medium 4, low 0. Partly cloudy uses three, overcast all.
- Radius 1.65 to 2.05 world units (×0.85 to 1.15 each), 0.66 to 0.8 as wide
  as long, a solid core inside half the radius and a soft edge to the
  radius. They run in three lanes 2.4 units apart along the clouds' drift,
  a second shadow half a lap behind the first, so sunny gaps pass between
  them. The drift is sideways on screen toward the band's side (the side
  the wind blows to) at every turn of the view, so shadows and clouds
  always move the same way (user feedback 2026-11-26); in the avatar views,
  where the band is off, they run along the wind.
- Speed (0.16 + 0.05 × wind class) units per second, 0.6× under overcast.
  One resolver drives the band too (`resolveCloudDrift` in
  `scene/weather/windClass.ts`): the band drifts a third as fast on screen
  as the shadows at the default zoom (100/3 px per unit), so the far clouds
  pass slower than the shadows under the near ones.
  They fade in and out over 1.4 units at the garden edges.
- Strength (the share of the shadow tint): 0.85 at midday, 0.7 at sunset,
  0.5 at night, ×0.9 under overcast (the target's 0.72 read too faint
  under the game's softer light), ×0.8 in heavy rain, ×0.65 at full snow,
  gone in fog. In the target about 13% of the garden is in shadow at
  a time when partly cloudy and 22% under overcast, and the garden's mean
  luminance drops 4% and 11%. A shadow never goes darker than the tint.
- The shadow is a blend between the unshadowed and the fully shadowed
  light, so the static cache's two captures (no response, full response)
  still reproduce it.

### Rain and heavy rain

User feedback, 2026-11-24: drops are smaller and more realistic than the
first target's fat teardrops.

- **Drops** are slim, falling raindrops as the eye sees them in motion: a
  thin streak 2 to 3 px wide with a slightly brighter, rounded leading end
  and a tail that tapers and fades. 14 px long in rain and 18 px in heavy
  rain, at any zoom. A light, saturated sky blue at opacity 0.55 to 0.75,
  so the garden shows through; no cartoon teardrop head and no glint.
  Camera-facing, depth-tested, no drops above 2.7 units (fade from 1.9).
- **Fall** 7.5 units per second (750 px/s), 9 in heavy rain, slanted by
  (0.45 + 0.75 × wind class) units per second sideways.
- **Count** 840 × tier (high 1, medium 0.7, low 0.35) × rainy^1.3 × the
  view's pixel area over 1280 × 800: about 840 drops in heavy rain and 430
  in rain on high. Smaller drops need more of them to read as rain. The
  count is continuous, no steps.
- **Garden budget.** Drops and rings change at most about 6% of garden
  pixels by more than 30 in RGB. The revised target measures rain 0.6% and
  heavy rain 1.2%, so slim drops leave plenty of room. Never denser than
  6%, at any time of day.
- **Splash rings** where drops land on ground or bed soil, never on props:
  a light ring with a blue edge, radius up to 0.12 units and thinner than
  the first target, 0.45 s each with a small impact dot in the first
  quarter. About 29 at once in heavy rain on
  high, half on medium, none on low. No crowns or spikes.
- **Puddles** on path and bare soil only, never on grass, beds or snow:
  flat one-piece shapes with a smooth wobbly outline (two harmonics, 10%
  or less), 0.2 to 0.6 units long, a sky-reflection gradient, a light rim,
  a glint and two ripple rings every 0.9 s. They appear as wetness passes
  0.25 to 0.85 and grow from 55% to full size.
- **Wet look**: richer, never darker. Saturation +22% at full wetness,
  roughness toward 0.26, a sky-coloured sheen of about 7% on up-facing
  faces. No darkening, no near-black overlay, no hash speckle. Wetness rises
  and dries slower than the rain itself. It lives only in the
  weather-integrated base-ground material: flat ground blocks (grass, sand,
  dirt, dry and swamp ground, stone, gravel, polished stone, snow), their
  ramps and corners, and the terrain rim and verge. Stone, gravel and
  polished-stone angles and stairs and props show no wet look:
  their wet overlay copy was retired on 2026-11-25, because it cost 24 draws
  and about 19,000 triangles on a full farm for 0.1 to 0.2% of the pixels.
- Heavy rain is rain at 0.8 or more: longer streaks, more slant, all
  puddles full. The garden never goes grey or dim; only the backdrop greys
  (see [Clouds and overcast](#clouds-and-overcast)).

### Storm and lightning

- Between strikes a storm must differ from heavy rain: a darker deck with a
  hint of violet in its shade (the grey keeps a little of it, more while a
  storm builds), stronger wind (leaves, sway).
- **The bolt** is the lightning icon: a chunky zigzag, extruded and
  bevelled, face and side in the petal yellows. 150 px tall at any zoom,
  about 0.46 as wide. It hangs from the lower edge of the overcast deck
  (thunder always brings the deck), its top tucked into the cloud, leaning
  outward about 10°, and it never touches or ends over the garden. Strikes
  alternate sides.
- **Timing.** It grows down from the cloud in 90 ms, holds with one damped
  width bounce of 22%, and pulls back up into the cloud between 0.42 and
  0.62 s. Its cloud glows warm only around the bolt's root: a soft
  fall-off from the root, at most 40% toward the glow role and held there
  for the first 0.2 s, radius about 60 px (smaller on a small screen to
  stay inside the flash budget, about 33 px on a 390 × 844 phone), fading
  by 1.1 s.
- **Schedule.** One strike every 7 to 11 s, never closer than 6.5 s, one
  flash per strike, never a double flicker.
- **Safety.** No light, exposure, fog or sky change, no halo, no screen
  flash, no impact ring, spark or strike point in the garden. The area
  whose relative luminance changes by 0.1 or more stays under 2% of the
  frame and inside one 341 × 256 px window under 21,800 px (WCAG 2.3.1).
  The target measures 0.85% by day and 1.5% at night, in one 170 × 200 px
  box.
- **No free sky.** Thunder always has a cloud: the bolt slides along the
  deck's lower edge to free sky; only if there is none does a shorter,
  96 px bolt hang over the garden's far edge, and only where its tip stays
  inside the band's over-garden strip (at most 10% of the view height below
  the garden's top) and it crosses no standing object. Where nothing fits,
  as on a farm that fills the view, the strike shows only the warm glow in
  the deck (`skyLayoutRules.boltOverGardenShare` sets the strip). The bolt
  fades in over the first fifth of its height below the deck's lip, so its
  root melts into the cloud. Thunder with little cloud still shows the deck
  for it.

### Snow

- **Flakes**: soft two-tone discs of 7, 9.5 and 12.5 px (50%, 35%, 15%), a
  light core, a tinted edge and a small highlight, so they read on sky and
  on snow cover alike. They fall 55 to 90 px/s, sway 0.18 units sideways
  and drift with the wind (0.08 + 0.26 × wind class units per second).
- **Icon flakes**: 12% of the flakes are the snowflake icon, six rounded
  arms each with a V of branches and a round hub, 20 to 26 px, an ice-blue
  face, a darker bevel rim and a glint toward the upper left, spinning at
  0.6 rad/s in either direction. They are drawn as a vector shape (a
  distance field) on one quad, crisp at any size and with no texture.
- **Count** 520 × tier (1, 0.6, 0.3) × snowy × the view's pixel area over
  1280 × 800 (about 415 at snowy 0.8 on high).
- **Cover** comes from accumulation, not snowfall. Snow that is setting in
  or melting is an even, translucent dusting whose opacity ramps smoothly
  with the amount on each face, worked out per pixel so the mesh's
  triangles never show: from about 0.6 cm to full at about 3.6 cm on a
  path (`snowCoverRules` in `snow/snowShader.ts`). Grass settles more slowly
  (`grassSettleCm` in `snow/snowPresets.ts`, the same on every grass tile,
  rim lip and verge): green below about 1 cm, a light see-through dusting at
  2 cm (about 45% of the cover), about 80% at 3 cm and full from 3.5 cm,
  well before the integrated ground snow takes the tile over at 5.4 cm.
  Melting runs the same way back. Grass snow lies flat while the dusting is
  see-through and grows its thickness between about 2.9 and 3.5 cm
  (`snowCoverRules.settleThicknessFrom`), so tile joints draw no light lines
  and the ground snow takes over without a step. It settles on faces that
  look up (normal from 0.22 to 0.62), keeps a light floor of 0.62 so it
  stays clean blue-white, folds over the terrain rim as a rounded lip on
  the rim geometry (never a band at a fixed world height) and shows no green
  rim line. On a ramp or corner it folds down onto the toe the same way,
  with no band or line along it. Crops keep most of their green (0.15 to
  0.3 cover). A
  canopy's lighter cap is covered completely, so no green crescent shows.
  About 14 small four-ray sparkles twinkle on full cover (2.6 s each).
  They hold no render lease. They twinkle only on frames another lease
  renders (falling snow, fauna, plant sway) and hold still when nothing else
  renders, so lying snow on a clear, still day keeps no frame loop running.
- **Bare trees**: in winter the round tree has no crown, only its branches,
  and no orange shows anywhere on it. Each tree goes bare between about 30
  November and 5 December and leafs out between about 23 and 27 March (leaf
  retention at or below 0.1, spread by 0.03 per tree: `autumnBareRetention`
  and `autumnBareRetentionSpread` in `scene/autumnCanopy.ts`). Its contact
  shadow keeps only the trunk blob. Lying snow settles as thin lines along
  the tops of the branches and caps on their tips (`snowPresets.treeBranches`:
  faces within about 50 degrees of up are fully covered, fading out by about
  70 degrees, so the branches stay whole against snowy ground). The crown
  returns in spring as the sparse stage and is fresh
  green from its first day.

### Fog and mist

- **Ground mist** in the lit materials: rounded bands 1.45 units apart in
  depth, broken into pills about 2.5 units long along the screen axis,
  sliding sideways at about 0.2 units per second, faster with wind. Every
  row varies its width, pill rhythm, density and place in its row, and a
  slower second wave makes the pills uneven, so a big farm shows mist
  patches, not stripes; where more than about four and a half rows show at
  once the bands soften toward the mist floor (to 55%). Densest at the local ground,
  gone 0.42 units up. At most 0.45 on the ground between objects and 0.3 on
  any bed, plant, animal or item.
- **Back haze** by screen height, not world depth: none below the view
  centre, rising to at most 0.2 near the top edge, the same at any zoom or
  garden size.
- **Mist rolls** are soft mist banks drawn like the band clouds: soft lobes
  with compact support added together (a long, low base lobe and two or
  three humps), low-frequency value noise that only roughens the soft edge,
  and a smooth fade over most of each lobe's radius. No mesh, no outline, no
  texture. Unlit two-tone shading in the mist roles: lighter top, `mistLow`
  toward the base. All rim and sky rolls are one instanced draw of quads;
  each quad lies along the roll's axis and turns its height to the camera.
- **Rim rolls** lie along the outer terrain rim, 1.7 to 2.3 units long with
  a gap between rolls, centred 0.36 outside the edge and 0.26 below the
  grass top, so the dense body hangs just under the soil and only the thin
  top of the mist overlaps it. Core opacity 0.92 × fog; the edges fade to
  nothing. The quad clears the grass lip and the soil body from the game
  camera. **Sky rolls**: soft fog-icon bands 240 to 300 px long in free sky,
  core opacity 0.6. At storm fog (0.35) both show only as a faint haze, and
  under light storm cover they follow the cover curve with the ground mist.
  Slide, bob and noise drift stop under reduced motion.
- Fog hides the sun (0.3 to 0.8) and removes cloud shadows. It keeps its
  hue: lilac by day, peach-pink at sunset, violet at night. Fog takes 40%
  of the key light (`keyFogLoss`), as in the target, so the garden keeps
  its shape and colour under the mist instead of going flat and grey. The
  fog a storm or a shower brings follows the island's cover curve (see
  [Clouds and overcast](#clouds-and-overcast)); fog of its own does not.

### Wind

- One wind scale everywhere: the API class 0 to 4. Every consumer
  (clouds, rain slant, snow drift, sway, leaves, swooshes, audio) reads the
  blended live value through one helper, not the debug override alone.
- **Swooshes** from class 1.3: 1 + 1.3 × (class − 1.3), at most 4 on high,
  2 on medium, 1 on low. A 190 px ribbon at least 5 px thick that ends in a
  curl of about one and a quarter turns. Over 2.6 s it draws itself on along
  its length and erases from the tail while drifting 60 px downwind, then
  rests 0.9 s. Free sky only; it may blow in from beyond a side edge. Faded
  by snow and by rain (×(1 − 0.6 × rainy)).
- **Leaves**: (class − 0.8) × 3.2, at most 14, about 20 px, tumbling across
  the view in the season's canopy roles. None in snow.
- **Sway**: plants lean and sway in gusts in proportion to the class; the
  grass and ground decoration sprites wobble on the same class, at 30% under
  reduced motion and not at all in calm air.

### Blends

- Every amount damps toward its target as in `scene/weatherBlend.ts`.
  Counts, opacities, colours and sizes are continuous functions of the
  blended amounts: nothing pops at a threshold. A cloud that joins fades
  and grows in over about 1.5 s.
- Wetness follows at 0.6× and snow cover at 0.5× the blend speed. Puddles
  fade as snow cover grows. The storm tint follows a damped storm amount,
  not the discrete thunder flag; the bolt itself stops at once.
- Check rain to snow, clear to storm, fog to partly cloudy and overcast to
  clear while they blend, not only the end states.

### Time of day and seasons

- Midday, sunset and night use the role sets above; every state stays
  light and colourful at each. At night clouds are lilac and still visible,
  rain turns pale (`#a8dcff`) so it reads on violet, and flakes stay bright.
- At night cloud takes only a quarter of its daytime share of the key and
  adds a quarter of its fill boost (`cloudNightScale` in
  `scene/gameArtStyle.ts`). With the full share the violet night fill lit
  the garden alone and washed soil pink and grass mint.
- The cover curve applies at every hour. Under lighter cover a sunset moves
  toward the clear sunset. A night keeps its cloud fill and gets back key
  and colour, so it stays at least as light as a clear night, with green
  grass and orange soil. Snow under cover 0.75 or more keeps exactly its
  full-cover light.
- Seasons change hue only. Spring and summer rain use the roles above;
  wind leaves take spring green and blossom pink in spring, the base canopy
  greens in summer and the four autumn canopy roles in autumn, beside
  `AutumnLeaves`. Winter: bare round trees with snow lines on the branches,
  snow cover and flakes, no puddles on cover, no leaves. Snow can fall on a
  green garden and lie without snowfall.

### Never hide the garden

| Limit | Value |
| --- | --- |
| Sky props over the garden footprint | None, except the band |
| Band | ≤ 10% of the view height, top edge only |
| Rain and splashes | ≤ about 6% of garden pixels changed by > 30 RGB |
| Mist on beds, plants, animals, items | ≤ 0.3 |
| Mist on the ground | ≤ 0.45 |
| Back haze | ≤ 0.2, top of the screen only |
| Snow on crops | ≤ 0.3 cover |
| Bolt over the garden | Never, except the 96 px fallback on the far edge, inside the band's strip and off every object; else the deck glow only |
| Lightning flash | No light, fog or sky change; ≤ 2% of the frame |
| Cloud shadow | Never darker than the shadow tint |

### Reduced motion

`prefers-reduced-motion` goes through one shared hook for every weather
renderer.

| Effect | Reduced motion |
| --- | --- |
| Rain | Falls at 1.4 units per second, slant at 20%; no splash rings or puddle ripples |
| Snow | Falls at 25% speed; icon flakes do not spin; no sparkles |
| Clouds | Fade in and out over 250 ms; no drift or shape change |
| Cloud shadows | Move at 40% speed |
| Bolt | No growth, bounce or glow: fades in over 1 s, holds 0.6 s, fades out over 1 s |
| Mist | Bands and rolls stand still |
| Wind | Swooshes fade in and out in place; no leaves; sway at 30% |

### Quality tiers

| | High | Medium | Low |
| --- | --- | --- | --- |
| Top-band clouds, plus the overcast deck | 10 + deck | 7 + deck | 4 + deck |
| Cloud shadows | 6 | 4 | 0 |
| Raindrops (heavy, 1280 × 800) | 840 | 590 | 295 |
| Splash rings | 29 | 14 | 0 |
| Snowflakes (snowy 0.8) | 415 | 250 | 125 |
| Swooshes | 4 | 2 | 1 |

Each layer is one instanced draw (clouds: at most three draws including
the deck).
No new fields in saved custom quality profiles: derive caps from the tier
and reuse the rain and snow multipliers. Weather animation uses scene-time
leases and the vertex shader, never a free-running frame loop. An ambient
effect that may stand still when nothing else moves (the snow sparkles)
takes no lease and advances only while the scene renders continuously
(`useSceneContinuousRenderReader`).

### Verify

1. Open the target and the game side by side: every state at midday,
   sunset and night, and at dawn and dusk in the game.
2. In the game, check the default island and the fauna-heavy farm at zoom
   75, 100 and the closest zoom, on a 390 × 844 phone view and in all four
   rotations: free-sky props never touch the footprint, clouds stay in the
   top 30 to 35% and cover the garden by at most 10%, overcast is one
   continuous deck, and weather still reads from the ground layer on the
   farm.
3. Measure rain coverage and the lightning flash area against the limits
   above, by day and at night.
4. Turn on reduced motion and check each row of its table.
5. Check low, medium and high, and the avatar views.
6. Check the blends listed above.
7. Sweep cover under storm, rain and overcast (`weatherReplace` with
   `cloudy` 0.4, 0.6, 0.66, 0.85 and 1.0, midday and night), and check
   `mode=snow` and `mode=cloudy`. From 0.75 up the garden matches the
   previous look; at 0.4 it reads close to the sunny garden. Lit soil sides
   stay orange at every cover the game uses (`atmosphereLighting.unit.ts`,
   "lit sides stay out of the day shade veil"). Fog and mist do not change.

## Motion

- Placing, picking up, dropping and clicking a block answer with squash and
  stretch that preserves volume: when height scales by `s`, width and depth
  scale by `1 - (s - 1) / 2`. The values are in
  `entities/helpers/bounceMotion.ts`. Harvest drops in the same way.
- A block squashes toward the point it stands on. Terrain does not hop when
  clicked, so the floor keeps reading as one surface.
- A click, pickup or landing bounce plays on the block where it is and never
  remounts it, so it never blocks a gesture: a block can be picked up
  mid-hop, and the first click of a double-click hops while the second
  still turns it. Only a new placement's drop starts the block fresh.
- A pop overshoots by 6% to 10% and settles within 450 ms. Hover scales to
  between 1.06 and 1.09.
- Living things breathe at rest: 2% to 3.5% at about one cycle every four
  seconds, each with its own phase. Canopies, crops, flowers and animals
  qualify. Props do not.
- Use `sceneSpring` and scene-time invalidation, and keep idle motion in the
  vertex shader for batched geometry. Never add a free-running frame loop.
- Honour `prefers-reduced-motion` with an instant change or a fade.

## Animals

Decided 2026-11-24. Animals are toy figurines, like the pieces of a modern
party board game, and speak the character language of the team's avatars
(`packages/ui/src/Avatar/assets`): big heads, large glossy ink eyes with a
white glint, blush, a small friendly mouth where it fits, simple markings and
warm saturated colour. Cute, not baby-ish. Take the avatars' shapes, not their
faceted shading, and never copy another game's characters.

Animals are rebuilt from scratch, never smoothed in place.
`assets/scripts/party-animals.py -- --asset Cow` runs the design module
`assets/scripts/party_animals/cow.py`, built on the shared kit in
`party_animals/kit.py`: primitives with clean topology, the face kit, leg,
foot, wing and tail builders, markings, and the checks below. All 17 animals
have a module; Cow and Cat are the templates. A new animal gets its own
module. `party-pass-animals.py`, the earlier in-place pass, now restyles only
the farmer avatar and refuses animal names.

Keep a helper that one animal needs in its module. Add to the kit only what
is general, as a new function or an opt-in option, and rebuild every animal
afterwards: each must give a byte-identical GLB.

### Rig contract

- Node names, transforms, parents, animations and material names never
  change, and `glbdiff` stays `ok`. Only mesh data changes, and which of the
  asset's existing materials a node uses.
- Keep one material per node. three.js loads a node with several materials
  as a `Group` holding one mesh per material, named after the mesh data, not
  the node. The generated `GameAssets.tsx` types each mesh node as a
  `THREE.Mesh`, and code that finds a node by name to hide or recolour it
  (cow coats) or matches its mesh name (`horseAppearance.ts` looks for
  `Horse_PintoPatch_`) would get the group or miss the name. Each material
  is also a separate draw. A face that needs another colour borrows a
  neighbouring node (the cow's blush is on `Cow_Forehead`) or an existing
  material recoloured for the job (`Material.Goat.Collar` is the goat's pink
  for its collar, nose and blush). Only nodes that already have several
  materials in the source (`Dog_Body`, `Dog_Head`) keep them.
- A node the design does not need keeps a hidden 12-triangle nub inside a
  neighbour (`hidden_nub`). Never make a nub of the only mesh under a pivot
  that a clip or the code moves: the motion disappears. The sheep's chewing
  moved nothing until `Sheep_Jaw` became a chin roll. Current exceptions,
  waiting for a decision: `Frog_Eyelid_*`, the slug's `Slug_MiddleBody`,
  `Slug_Foot` and lower feelers, and the bat's elbow and hand wing nodes
  (all below).
- A node a clip animates keeps its role. Only nodes nothing animates may
  take another job: `Cat_Eyelid_*` hold the cat's glints because no clip
  moves them; a blink clip would need the glints moved first. `Frog_Blink`
  only slides `Frog_Eyelid_*` 0.07 down, which cannot cover an eye big
  enough for the glint rule, so the frog's lids are hidden nubs and its
  blink does not show. A visible blink needs a clip or code change, for
  example scaling `Frog_Eye_*` vertically.
- Design in the pose players see: the stored pose for animals that code
  poses (cow), the idle clip's first frame for clip-animated animals (cat).
  A .blend with clips on NLA tracks opens with a clip evaluated into the
  pivots it drives, so its loaded state is not the rest pose the GLB
  carries; use `clip_pose_space` to design and `glb_rest_pose` before code
  pose checks on animals that have both clips and code poses.
- Author legs, feet, wings and tail slices in their own pivot frames, so
  every clip and procedural rotation moves them cleanly.
- Some rigs keep their pivots at the model origin: every slug pivot,
  feelers included, and the bat's wing pivots. A joint there cannot
  hide inside a sphere on the pivot. Cut where the relative motion only
  slides along the surface (the slug cuts at y = 0), let an overlapping pad
  stand clear of the body by more than the parts move, and check the gap
  between the eyes at the code's independent feeler wobbles. Panels on the
  bat's elbow and hand pivots fan out as spikes at the top of a flap, so
  each bat wing is one panel on its root pivot. A folding wing needs those
  pivots moved to the elbow and wrist, which is a rig change.
- Feet stand on the ground at rest, within 0.03 model units in clip poses.
  Facing does not change. Width, length and height stay within 10% of the
  model the redesign replaced (the GLB at the branch point, not the in-place
  pass), so pens, homes and paths still fit; check the home in the game.

### Proportions

| Body type | Examples | Head to body volume | Body length to height | Visible leg |
| --- | --- | --- | --- | --- |
| Farm animal | cow, horse, goat, sheep, piglet | 0.55 to 0.7 (cow 0.67 with muzzle) | 1.35 to 1.5 (cow 1.44) | 10 to 15% of height (horse about 18%, set by its knee pivots) |
| Pet | cat, dog, rabbit | 0.85 to 1.1 (cat 0.95) | 1.25 to 1.4 (cat 1.31) | under 15%, mostly socks |
| Bird | chicken, small bird | 0.6 to 0.9 | one egg, about 1.2 | short capsule legs on round feet |
| Small critter | frog, squirrel, slug, bat | 0.8 to 1.2 | one bean | stubs, often hidden |
| Insect | bee, ladybug, butterfly | not applicable | one rounded body | none or tiny |

- One soft superellipsoid per body and per head (`blob`), exponents 0.8 to
  0.95, the belly side flatter (0.55 to 0.75), the rump 4 to 12% wider than
  the chest. Never a cluster of spheres.
- Leg pivots fix how long a body must be, so a short body reads short by
  height, not by cutting its ends: raise the back into a full haunch, fill
  the low chest that holds the front leg tops, and let a pet's head reach
  back over the chest. A long low body reads as a log (the first pilot cat
  was 1.73).
- Head and body overlap directly, at least 0.05 model units at rest and in
  every clip (cow 0.11, cat 0.12). No neck lump: a neck node stays hidden at
  rest and only fills the joint when the head dips to graze. The horse is
  the exception: its mane rides on `Horse_NeckPivot`, which grazing pitches
  67°, so it keeps a thick, flared neck under the mane. Measure its neck in
  the body and its head in the neck.
- Heads may grow about the head pivot, but never past the body's volume.
  Round-faced animals (cow, piglet) may have a head wider than the body (cow
  1.24 against 0.98). Long-faced ones (horse, goat, sheep) keep the head
  narrower than the body, or they turn into bobble-heads.
- `proportion_report` measures closed volumes, so judge by eye where it
  cannot: a wool bonnet shell (sheep) is not counted. A small critter whose
  head pivot only nods a few degrees may carry the whole head-and-body bean
  on the head node, with the body node a nub (bat); the ratio does not
  apply, and wing, tail and leg roots must stay buried through the nod.
- Insects and other critters under about 20 pixels on screen read by
  silhouette and colour blocks first. Their faces follow the insect
  exception in [Budget and detail](#budget-and-detail).

### Face kit

Tune faces to the game camera, which looks down at about 30 to 35 degrees,
not to a front view. Features in the lower half of a head shrink and hide
from that camera.

- Eyes (`eye`): tall ovals, 28 to 32% of head height on farm animals and
  about 36% on pets, about 20 to 24% of head width, set wide (0.2 to 0.27
  head widths from the centre) so both read in three-quarter views. Put the
  centre at or above the middle of the head (cow 0.2, cat 0.065 above the
  head centre); the surface there already tilts the pad toward the camera.
  Ink violet `#5c4590`, gloss 0.35, domed. Never black.
- Critters at a runtime scale of 0.3 or less (squirrel, frog, slug, small
  bird, bat) size the eye to the glint. The glint's 0.03 game units are 0.1
  to 0.15 model units there, so the eyes are about half the head height
  (the small bird's about 60%) and the glint about half the eye's width.
- Where a behaviour pitches the head down (the cow grazes at 64 degrees),
  the camera sees the crown: eyes high on the face and big ears standing out
  level from the upper head, lining up, keep eyes, pink and gold in view.
- Glint: `#fff4dc` at the upper left, the same world direction for both
  eyes, at least 0.03 game units across where it shows, and fully inside the
  eye. `eye` places its glint 0.24 of the eye height up and 0.2 of its width
  out, so a large glint on a small eye hangs over the rim and is clipped
  thinner. Enlarge the eye instead (dog) or build the glint in the module
  (bat).
- Iris only where the species needs colour to read, such as the cat's green.
  Raise the ink pupil so the iris shows as a crescent at least 0.03 game
  units tall below it. A thin ring all round vanishes.
- Blush (`blush`): a pink oval below and outside each eye, about 0.4 of the
  eye height and 0.8 of its width. On pink skin it uses the stronger blush
  role, or it disappears (piglet). An asset with no pink material uses a
  cheek marking of the species instead (the small bird's white cheek).
- Mouth (`smile`): an ink tube only where it stays 0.03 game units thick
  (radius 0.024 model units on the cow at scale 0.66). Leave it out where it
  cannot (the cat), or where the tube would be wider than about 15% of the
  muzzle and read as a moustache (the dog). Never a low-contrast line in a
  skin colour.
- Muzzle: one smooth form, 70 to 75% of head width on farm animals, gloss
  0.45, ink nostrils. Dark animals get a large light muzzle that frames the
  nose. A muzzle that shares its material with the blush keeps the 0.45
  (horse; `Horse.tsx` leaves it out of the fur roughness). A flat disc such
  as a pig snout is a revolved form, not a cube-sphere, so its rim does not
  show corners up close (`snout_disc` in `piglet.py`).
- Beaks (`beak`): a rounded cone from inside the head, curling a little
  down, flattened top to bottom, its tip at least 0.03 game units across.
- Antennae: a thin `tube` with a ball tip, both at least 0.03 game units
  across at the runtime scale, except on insects.
- Ears with a lining that follows their outline, where the rig has a lining
  node: `slab_leaf_ear` (cow; an even slab with a pad lining that has its own
  clean rim), the sheep's pillow ear, `cone_ear` (cat) and the rabbit's
  ear. Turn the lined face up and forward so the colour shows from the game
  camera. The goat, piglet, horse and dog have no node for a lining under
  the ear pivots the code moves, so their ears are one colour. A pad
  lining stands higher above the ear than the ear's facets sag (0.018 on the
  bat's 12-segment ear), or ridges show through it.
- Do not point an ear's axis at the camera's elevation of about 30°: it
  shows only its edge from the side and reads as a horn. Use a nearly level
  ear with its face up (piglet, about 13°) or one steeper than about 60° with
  a folded tip. No round sticker pads, no spikes or cheek tufts on the head
  silhouette.

### Legs, feet, wings and tails

- Legs (`pivot_leg`): round capsules, 10 segments, the top sphere centred
  on the hip pivot. A top buried in the body takes `arc=1`, which saves
  about 48 triangles a leg for the rims. Move a leg only along the pivot's
  swing axis (local X) to tuck it under the body. The top reaches at least
  0.02 into the body in every pose.
- Two-segment legs (horse knees, frog hind legs): `limb_segment` from the
  hip to a ball centred on the knee pivot, then `pivot_leg` on the knee with
  a top radius about 0.95 of the ball, so the knee never opens or z-fights.
  The horse's thigh is a cone a little narrower than the knee dome, open at
  both buried ends, that ends inside the lower leg's dome: 20 triangles and
  no knee ball.
- Legs with no hip pivot: the dog's code swings `Dog_Leg_*` about their own
  middle and moves `Dog_Paw_*` on their own. Use `mid_pivot_leg` with the
  top buried deep in the body, closed paws, and check `joints` at the swing
  extremes with the paw offsets the code applies.
- Feet (`pivot_foot`, `hoof_profile`, `paw_profile`): revolved about the leg
  axis, the top rim ending on the leg radius, so leg and foot meet on one
  clean circle. Only for a foot under the same pivot as its leg. Hooves are
  wider than the leg (cow 0.19 against 0.145). Pet paws are tall white
  socks. Hoof and paw rims are outlines the camera sees up close, so give
  them more segments than the leg: `pivot_foot_rings` with `HOOF_RINGS`
  (1, 8, 16, 16, 12, 10: a coarse sole, 16 segments on the wall and rim,
  stepping back to the leg's 10; 114 triangles) or a paw set such as the
  rabbit's `PAW_RINGS`.
- Where a clip leaves the legs at a stored tuck (the cat's idle keeps 0.663
  rad), keep the legs short and the feet under the body so the tuck reads as
  a stance.
- Wings (`wing_panel`): one rounded teardrop panel per wing node, rooted at
  the wing pivot just inside the body, the flat face toward the camera.
  Butterfly wings are a fore and a hind panel per side. Each bat wing is one
  `membrane` panel on its root pivot (see [Rig contract](#rig-contract)).
- Tails (`sliced_tail`): one Catmull-Rom curve through the tail pivots, cut
  into one tube per pivot node on shared rings, buried in the body at the
  root. Joints are spheres centred on the pivots. A colour tip meets its
  neighbour on a shared ring with a joint ball (`collar="ring"`), which
  leaves no sawtooth at the seam. Give the slices the normals of the uncut
  tube (`shared_normals` in `horse.py`), or every pivot shows a band, and
  check that short, thick slices face outward (`_orient_by_vote`). No kinks,
  gaps or zig-zag seams in any pose. A tuft or puff at the end is light or a
  body colour and hangs no lower than the hock, or it reads as a fifth foot.
- Horns: short and chunky, still rising at the tip. A tip that levels off or
  hooks forward folds into a ring from the game camera.

### Markings

- Coat patches, bibs and bellies are decals (`decal`): smooth outlines from
  2 or 3 harmonics with amplitudes of 0.16 or less, 14 or more segments (18
  to 20 on big patches, with a coarser interior through `inner_segments`)
  and 3 rings, lifted 0.012 to 0.02 above the body (more on a coarser body;
  the cow uses 0.02) with the rim tucked 0.012 to 0.014 under it. With fewer
  rings or less lift the body shows through.
- Few, bold patches that wrap over the back, since the camera sees the back
  first: 2 to 4 patches covering 30 to 40% of the top view. No straight-edged
  outlines. Only put a marking where a game view sees it: the cat's bib sat
  behind its head and its belly faces the ground, so both are nubs now.
- Spots are for species whose markings are spots (ladybug, frog back spots):
  `spot`, few and big, at least 0.06 game units across. No polka dots on
  fur.
- Stripes that go all the way round (bee stripes, collars) are
  `band_decal`s, with both edges tucked like a decal.
- Where parts must read as one surface, give them the underlying form's
  normals as custom normals; the glTF export keeps them. A decal the runtime
  recolours to the body colour (the horse's pinto patches on five of six
  coats) otherwise shows its outline through the shading, and a neck that
  blends into head and body shows a seam (`adopt_normals` and
  `blend_normals` in `horse.py`).
- A marking node stays under the same pivot as the body it lies on. Coat
  variants share one geometry (the cow test pins the shell at 0.035 or less).
- Dark animals carry light accents at the face and the ends (muzzle, socks,
  tail tip), so they still read at night.

### Colour and materials

| Role | On screen | Roughness |
| --- | --- | --- |
| Cream fur, light and shade | `#f2e0c0`, `#eddab8` | 0.8 |
| White fur, light and shade | `#f2ddbe`, `#e8d4b5` | 0.8 |
| Brown patch | `#c46c3a` | 0.8 |
| Slate patch (the "black" cow) | `#73708f` | 0.8 |
| Pig skin pink | `#f6929a` | 0.6 |
| Muzzle and snout pink | `#f6a59a` | 0.45 |
| Inner ear and blush | `#f59a92` (cat `#f49aa6`) | 0.8 (cat 0.55) |
| Blush on pink skin | `#f0647f` | 0.8 |
| Horn | `#efbd62` | 0.55 |
| Hoof | `#8e6f80` | 0.55 |
| Eye ink, nostrils, smile | `#5c4590` | 0.35 |
| Glint | `#fff4dc` | 0.35 |
| Cat iris | `#a8dd5a` | 0.35 |

Cream and white are warmer than they look in the file: the cool fill takes
saturation off them on screen. The earlier `#f0e6d6` white showed 0.05 to
0.06 at noon against the 0.10 floor for neutrals; these values show 0.11 to
0.15. Sample them in the game.

Pig skin is a pastel below the 0.55 saturation floor for main surfaces; a
saturated pink read lipstick red. Cool pinks drift toward lilac on screen,
so author pinks about 10 degrees warmer than the target. The value floors
apply to the sunlit colour: the shaded half of a dark accent, such as the
goat's charcoal beard, goes darker like everything else in shade.

Flat colour only, no textures. Author on-screen colours through
`screen_to_albedo` (`apply_colours`). Where code overrides a colour (cat fur,
horse variants, rabbit coats, bird, bee, butterfly and ladybug colours, cow
coats), author the runtime albedo itself so the file matches the game, and
keep the material names the code looks up. Where code also sets roughness,
it keeps the face kit's gloss on ink, glints and muzzles (`Bees.tsx`,
`Horse.tsx`).

### Budget and detail

- About 3,000 rendered triangles per farm animal, pet or chicken, never
  more than 15% over (3,450), and about 2,000 per small critter, small bird
  or insect, never more than 15% over (2,300). The farm animals and pets
  render 3,216 to 3,444 (the cow 3,442, 3,886 in the file with both coats),
  the critters and insects 1,938 to 2,294.
- Spend triangles where the camera sees an outline: head and body
  silhouettes, ear and lining rims, hoof and paw rims. Save them on hidden
  parts: buried leg tops (`arc=1`), soles, decal interiors.
- Cube-sphere resolution 6 for big bodies and heads, set per axis for long
  bodies (`blob(res=(5, 7, 5))` on the cow and horse, `(6, 8, 6)` on the
  goat), 4 or 5 for muzzles, 2 or 3 for small parts. 10 segments for legs
  (the kit's `LEG_SEGMENTS`), 16 on hoof and paw rims, 6 for horns with the
  buried root left open, 8 for other tubes (`TUBE_SEGMENTS`), 8 to 10 for
  tails, 14 to 20 for ears and decal outlines.
- No visible part thinner than 0.03 game units at the runtime scale (cow
  0.66, cat 0.42; the scale is in the entity code), checked across the part.
  The check measures each part's own extent, so look at mostly buried parts
  such as ear linings from the side as well.
- Insect exception: at the bee's 0.095, the ladybug's 0.085 and the
  butterfly's 0.108 runtime scale, 0.03 game units are 0.28 to 0.35 model
  units, a third of a ladybug's shell. Body, head and wing masses meet the
  floor. Eyes, glints, antennae, legs and spots may go down to about 0.01
  game units, 5 pixels at the closest zoom, and read as colour blocks at the
  default zoom.
- Smooth shading, no modifiers, no geometry nodes. Shapes that meet do so
  on purpose: overlapping, tucked under, or on a shared circle.

### Verify

1. Run the module. The runner prints the size against the replaced model,
   the proportions (`proportion_report`), the triangles, the thickness and,
   for every clip at 8 frames (`clip_report`) or every procedural pose
   extreme (`procedural_report`), the foot height, how deep legs, head and
   tail sit in the body, any foot clipping and any `joints`. Fix every
   `LEG GAP`, `HEAD FLOATS`, `TAIL GAP` or `JOINT GAP`. Procedural poses
   apply the rotation, position and scale offsets the entity code writes,
   with three.js semantics (`apply_pose`), including body bob and breathing.
2. Export with `export-game-assets.py`, check that `glbdiff` is `ok`, bump
   the version and run the asset and fauna tests.
3. Look at a contact sheet in four rotations and in the clip poses, then in
   the game: `/debug/animals` (herd and path buttons) and the `fauna-heavy`
   profile at midday, sunset and night (`&mode=night`), at the far zoom and
   at the closest zoom (500), where faceting on outlines shows. Bees fly only
   by day (`isBeeActive`), so check them in the late afternoon, and bats
   only at night. `/debug/entities/<Name>` shows only the animals that are
   blocks: cow, goat, horse, rabbit and sheep.

Known exceptions, from the clips and code rather than the models:

- The cat's PreyWatch and Crouch put its paws 0.14 below the ground and
  LayDown, LyingIdle and StandUp 0.21 (the clips lower the body pivot; the
  pillow hides it).
- The cow's breathing lowers its feet 0.025 (the code scales the body pivot,
  legs included) and its trot bob lifts them 0.033. The horse's trot lifts
  all four hooves up to 0.059 (the clip raises the body pivot 0.04).
- The squirrel's Forage puts its front paws 0.08 to 0.11 below the ground
  (the clip lowers the body 0.05 and pitches it 10° while the paws dig);
  Bound and Scamper each have one front-paw frame at about −0.04.
- In the goat's browse pose the head reaches only 0.027 into the body;
  `Goat_Neck` fills the joint.
- The piglet's wallow rolls its body pivot 0.2 rad each way, which dips the
  feet on one side below the ground.

## Generated images

HUD icons and operation illustrations already use this language. Keep new ones
consistent with `apps/garden/public/assets/hud/README.md`: thick bevelled
geometry, colours from the role table and a soft upper-left highlight. Block,
top-down and plant images are rendered from the game and are regenerated, not
edited by hand.

## Review checklist

- [ ] No sharp edge is visible, and shading is smooth.
- [ ] The floor is continuous. Only exposed terrain edges are rimmed.
- [ ] Natural materials use the shared painted textures, with no visible seam.
- [ ] Reads at the far zoom and in all four rotations.
- [ ] On-screen colour is within range, metalness is 0, roughness matches a
      band.
- [ ] Shows three distinct values at midday. Checked at dawn, dusk, night
      and overcast, and stays light and colourful in each.
- [ ] Seasonal colours come from the seasonal roles, not a muted palette.
- [ ] Has a contact shadow.
- [ ] Motion follows the timing rules, including reduced motion.
- [ ] Crops are recognisable as their species.
- [ ] Footprint, pivot and exported object names are unchanged.
- [ ] Nothing is copied from the reference game.
