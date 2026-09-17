# Public website artwork audit

Audited `apps/www` on 15 September 2026. A read-only subagent inventoried emoji,
Lucide and custom-icon use, then reviewed the replacement semantics. The table
below records the implemented scope and the deliberate exceptions.

## Visual direction

Match the game's chunky 3D geometry, bevels, tactile materials and soft lighting.
Use the whole existing library as a reference, including water, flowers, weather,
avatars, editorial compositions and achievement awards. Gold is suitable for a
trophy or a warm material; it is not the default color for every object.

New artwork uses coral, blues, leaf greens, cream, terracotta and natural skin
tones. Transparent silhouettes remain legible on light and dark backgrounds.

## New and reused artwork

| Asset | Idea and palette | Use |
| --- | --- | --- |
| Leaf | Thick green leaf with a raised vein | Plant nutrition, growth and seasonal headings |
| Location | Coral pin with an open cream-rimmed hole | Delivery checker and pickup slots |
| Community | Handshake, natural skin tones, blue and rust sleeves | About value card |
| Globe | Blue oceans, green land, cream frame and indigo stand | About accessibility value |
| Idea | Cream bulb, warm light, blue and silver base | Technology and helpful information |
| Plant disease | Spotted green seedling, soil and teal magnifier | Generic category cards and 192px detail artwork |
| Plant pest | Green caterpillar on a nibbled leaf | Generic category cards and 192px detail artwork |

The seven new WebP files and exact image-generation prompts are in
[`packages/ui/src/GameIcons/assets`](../packages/ui/src/GameIcons/assets/www-prompts.json).
Icons use a maximum 320px content edge; the two plant-health illustrations retain
768px. All have transparent padding. The disease and pest images represent
categories, not photographs or diagnostic evidence of individual species.

Seven additional shared exports reuse existing artwork: Calendar, Basket, Harvest,
Blossom, Sun, Moon and Snowflake. The weather primitives moved unchanged to the UI package;
the composed in-game weather renderer reads the same files. The basket matches
the HUD source byte-for-byte. Calendar and Harvest already existed in lifecycle
artwork. No new sunflower mascot was generated.

`PublicGardenIllustration` reuses the existing delivery truck, seed/transplant and
raised-bed-care compositions. Delivery and sowing page headers now have proper
192px visuals. The harvest-trace fallback reuses the sowing composition when no
photo exists. Seed packages use the shared packet icon only when no image exists.

## Replacements and example routes

The routes below identify examples to open on a PR preview or local WWW server.
They do not imply these changes have been deployed to production.

| Surface | Replacements | Main source |
| --- | --- | --- |
| `/dostava` | Truck hero; seedling, gift, receipt, location, calendar and information decorators | `app/dostava/page.tsx` |
| `/dostava#cijena-dostave` | Styled location in the address checker; accessible text unchanged | `app/dostava/DeliveryAvailabilityChecker.tsx` |
| `/dostava/termini` | Calendar hero, delivery/pickup legend and slot icons, idea hint | `app/dostava/termini/page.tsx` |
| `/cjenik` | Receipt hero; currency, seedling, tools and delivery section icons | `app/cjenik/page.tsx` |
| `/sjetva` | Sowing hero; receipt, journal, calendar, leaf, seedling, sun and idea headings | `app/sjetva/page.tsx` |
| `/o-nama` | Four 64px value-card visuals | `app/o-nama/AboutValueCard.tsx`, `app/o-nama/page.tsx` |
| `/preporuke`, `/suncokreti` | Gift, receipt and energy cards; sunflower reward/package amounts | `app/preporuke/page.tsx`, `app/suncokreti/page.tsx` |
| `/kontakt` | Mailbox and contact objects; real WhatsApp brand mark | `app/kontakt/page.tsx` |
| `/mcp` | Journal, garden and basket access-level visuals | `app/mcp/page.tsx` |
| `/bolesti`, `/stetnici`, and their detail pages | Generic disease/pest artwork at 40px and 192px | `components/plant-health/PlantHealthIssueCard.tsx`, `PlantHealthIssueDetail.tsx` |
| `/biljke/[alias]` | Water, thermometer, light, leaf, calendar, seedling and harvest yield icons; calendar tabs | `app/biljke/[alias]/*AttributeCards.tsx`, `PlantCalendarPicker.tsx`, `PlantPageHeader.tsx` |
| `/radnje/[alias]` | Garden, whole-bed and plant context; generic stage seedling and all-plants application card | `app/radnje/[alias]/OperationAttributesCards.tsx`, `OperationApplicationsList.tsx` |
| `/sjeme` and seed details | Packet illustration when package and sort images are unavailable | `app/sjeme/SeedImage.tsx` |
| `/trag/[token]` | Photo fallback; watering, photography, tools, seedling, calendar and harvest decorators | `app/trag/[token]/page.tsx` |
| `/vrtovi`, `/vrtovi/[id]` and public profiles | Garden preview placeholder, creation date, plant count, sunflower stats | `app/vrtovi/PublicGardenPreviewImage.tsx`, `PublicGardenSummary.tsx`, `PublicGardenStatsAccordion.tsx` |
| `/korisnici` | Styled leaderboard trophy | `app/korisnici/UserLeaderboard.tsx` |
| `/outlet` and landing outlet section | Seedling decorators; real product artwork retained | `app/outlet/page.tsx`, `OutletLandingSection.tsx`, `OutletOfferCard.tsx` |
| `/blokovi` and block details | Shared sunflower currency artwork | `app/blokovi/BlockGallery.tsx`, `app/blokovi/[alias]/page.tsx` |
| Homepage garden previews | Shared snowflake/sun in the winter-mode switch | `components/WinterModeToggle.tsx` |

All source paths in the last column are relative to `apps/www`.
Operation images and category controls in WWW opt into `variant="game"` on the
shared OperationImage/OperationCategoryIcon components. The 192px operation hero
uses a full illustrated category fallback when its cover is absent; real covers
remain unchanged. Other applications keep the existing default variant.

Dates, prices, measurements, status values, metadata, structured data, links and
request handlers retain their existing meaning. Closed delivery slots keep their
struck-through times and dashed borders, plus explicit grayscale/opacity for the
bitmap. Artwork beside visible labels is decorative; standalone sunflower prices
retain the accessible currency name.

## Keep as text or functional symbols

- Friendly copy: homepage “Vrt po tvom 🌱”, About “Tvoj vrt, gdje god bio 🌱”,
  the contact closing “😊🌻”, delivery closing “🥬📦”, and newsletter “☺️”.
- Currency inside prose, metadata, referral instructions, shareable strings and
  plain-text formatters, including `publicGardenFormatting.ts`. Only standalone
  rendered currency icons were replaced.
- CMS rich text, Markdown, FAQ answers, plant descriptions, tips, user-authored
  content and editorial text. There is no global emoji replacement or rewriting
  of persisted CMS data.
- Search, close, arrows, editing, download, loading, warnings, checks,
  verification, discounts and exact plant-density diagrams. Attribute-card measurement decorators now use the shared 3D artwork described below.
- The outline/filled heart on `PublicGardenLikeButton`: its appearance communicates
  selected state. Preserve that distinction instead of substituting a static image.
- Physical raised-bed identifiers and the exact plant-grid symbols. Shared
  physical-ID rendering was not changed.
- Brand marks, mascot artwork, actual catalog photographs, garden previews,
  3D models, avatars and achievement awards.
- The unindexed `/development` resource menu keeps its technical emoji mnemonics.
  It is an optional separate tooling illustration project, not customer-facing
  artwork left unfinished. Pet-care artwork is covered in the follow-up below.

## Review examples

Storybook `apps/www/Visuals/PublicVisuals` has Light and Dark stories with real
public card components, 192px category artwork and a 24–96px icon matrix.
`packages/game/Icons/InGameIcons` includes the new exports in the searchable
Public-site artwork group. `packages/ui/Showcases/ComponentShowcases` includes the
public composition, and the existing WWW AttributeCard stories use shared icons.

Example local paths, using the port chosen for the running server:

- `/?path=/story/apps-www-visuals-publicvisuals--light`
- `/?path=/story/apps-www-visuals-publicvisuals--dark`
- `/dostava`, `/o-nama`, `/sjetva`, `/bolesti`, `/stetnici`

Validation includes filtered UI/game/WWW/garden types, Storybook and WWW builds,
game tests, relevant public content/price/delivery tests, and browser checks for
asset decoding, responsive layout, accessible currency and light/dark examples.

Recorded checks for this change: 1,980 game tests and 35 focused WWW tests passed.
Browser review covered 18 public routes at 1280px and 360px with no failed styled
artwork or horizontal overflow. A December browser clock verified the real
homepage winter switch updates both its state and sun/snowflake artwork. The
public Storybook examples passed WCAG A/AA checks in light and dark themes.


## Follow-up: catalog, pets and empty collections

After #4847 merged, a second read-only audit identified the remaining customer
surfaces. This follow-up adds four new transparent, 384px WebP assets generated
with built-in image generation. Exact prompts and the three inspected style
references are in
[`www-followup-prompts.json`](../packages/ui/src/GameIcons/assets/www-followup-prompts.json).
Only resizing and WebP encoding were applied; generated alpha is retained.

| Artwork | Palette and meaning | Consumer |
| --- | --- | --- |
| Paw | Coral/pink pads with deep raspberry sides | Pet habits and introduction |
| Pet home | Teal roof, cream front, natural wood, coral step | Generic shelter information; actual pet-home snapshots remain |
| Market stall | Coral/cream awning, teal panel, green vegetables | Brand-logo fallback and OPG partner heading |
| Blocks | Teal, coral and leaf-green cubes | Block search fallback and empty block catalogue |
| Cloud (reused) | Existing game cloud, byte-for-byte unchanged | Pet weather routine and original game weather compositions |
| Magnifier (reused) | Existing verification magnifier | Larger search introduction artwork |

`DirectorySearchResultVisual` now uses the shared game artwork for plants,
varieties, diseases, pests, seeds and blocks, plus the game operation-category
variant. Unknown result types use the journal and unknown operations use tools.
The existing image URL wins over every fallback. Header results retain their
40px tile with 28px artwork; full search results keep a 56px tile with 32px artwork.

| Example route | Follow-up changes |
| --- | --- |
| `/blokovi/ljubimci#pas` | Pet-home/paw/heart introductions and paw/sun/moon/cloud/shelter details |
| `/pretraga` | 80px magnifier in the initial search prompt |
| `/pretraga?pretraga=biljka` and header search | Matching styled category fallbacks, including missing/unknown categories |
| `/sjeme/brend/[slug]` | Market-stall fallback with brand initials; styled location and globe |
| `/sjeme/[slug]` | Location and plant-count artwork; barcode, prices and exact measurements stay functional |
| `/radnje` | Market-stall icon for OPG partners |
| `/biljke` | Styled calendar tab and seedling on the sowing filter; switch state and URL behavior unchanged |
| `/biljke/[alias]`, `/outlet` | Styled origin pin and availability calendar |
| `/biljke`, `/sjeme`, `/blokovi`, `/bolesti`, `/stetnici` with a non-matching `pretraga` | 64px category artwork beside the existing empty message |
| `/vrtovi` and public profiles | Garden/trophy artwork for empty public collections; no specific award implied |
| `/dostava/termini` without available dates | Calendar artwork beside the existing explanation |

`PublicEmptyState` is scoped to these spacious public collection states. The
compact `NoDataPlaceholder` used by individual attribute panels and other dense
content is unchanged. Seed result announcements and the block gallery's
`hasOtherResults` guard remain intact.

Storybook `apps/www/Visuals/PublicCatalogVisuals` provides Light/Dark examples
using the real pet cards, search fallbacks in both sizes, a provided search image,
brand initials versus provided logos, and empty collections. These examples also
appear in PublicVisuals and the component showcase; the six added exports appear
in the searchable in-game icon inventory.

### Deliberately remaining

The text/content and functional exceptions listed above still apply. Text-only
navigation/category chips do not need new pictures. Extra 192px heroes for every
catalogue and decorative bird/bee illustrations would be new layout work rather
than unfinished replacements; avoid pushing filters and products down on mobile.
No sunflower mascot, real logo, pet-home snapshot, product photo or physical
raised-bed identifier was replaced.

Follow-up validation: UI, game, garden, WWW and Storybook typechecks; WWW and
Storybook production builds; 4 weather-composition tests and 10 pet/profile tests.
The two new Storybook themes passed WCAG A/AA checks with all 18 distinct artwork
sources decoding. Ten public routes were checked at 1280px and 360px without
horizontal overflow or failed styled assets. The sowing switch was exercised in
both directions while preserving the search query. Brand-fallback initials now
use foreground text after the contrast check caught the previous muted color.
Storybook scans all WWW app components so imported public layouts match the site.


## Landing newsletter illustration

The large newsletter artwork was a missed style mismatch in the first two
passes: its pastel texture and pale baked-in shadows differed from the faceted
sowing, raised-bed-care and delivery compositions. It is now a transparent 3D
still life with a teal envelope, ivory gardening note, red tomato, orange carrot
and one correctly connected trowel. Platform logos and functional form-state
icons remain intact.

The built-in image-generation prompt, reference paths and input Git revision are
recorded in [`newsletter-prompt.json`](../apps/www/assets/newsletter-prompt.json).
The replacement lives at `apps/www/assets/NewsletterVisual.webp`, is 768px square,
and retains the generated alpha. Resizing and WebP encoding reduced it from
105,546 to 61,474 bytes. The newsletter uses `PublicGardenIllustration` at up to
320px, with explicit dimensions, lazy loading and decorative empty alt text.

The other large landing/service illustrations, shopping basket and outlet mark
were inspected and already share the faceted game style. Real scene previews,
mascot art, brand logos and the soil-composition explanatory diagram retain
their own purposes.

Review `apps/www/Visuals/PublicGardenIllustration` (Newsletter / NewsletterDark)
at 320px, or all four editorial compositions in PublicVisuals (Light / Dark).
The newsletter form and its server action have no behavioral changes.

Newsletter validation: WWW and Storybook production builds and their TypeScript
checks pass. The two dedicated stories pass WCAG A/AA checks and fit at 360px.
Chromium verified the actual landing newsletter in light and dark themes at
1280px and 360px: artwork decodes, dimensions and lazy loading are present, the
email input can receive focus, and the image/form controls remain within the
viewport. No newsletter subscription was submitted during visual verification.

## Attribute-card follow-up

The plant detail audit also covers varieties (which reuse the plant sections),
operations, seed packets, seed brands and block details. Five new transparent
384px WebP assets use the backpack/water references and colorful, faceted style.
Exact built-in image-generation prompts are in
[`attributes-prompts.json`](../packages/ui/src/GameIcons/assets/attributes-prompts.json).

| Surface | Updated artwork |
| --- | --- |
| Plants and varieties: spacing, depth, germination time, soil | Teal ruler, soil + ruler composition, coral stopwatch, layered soil block |
| Operations: frequency, duration, price, unknown application | Reused history clock, stopwatch, receipt, tools |
| Seeds: weight, germination, area, barcode, price | Blue scale weight, seedling, garden plan, cream/coral tag, receipt |
| Blocks: height, stacking | Ruler, reused colored blocks |
| Seed brands | Already styled: location, globe and market-stall fallback; no additional replacement |

`GameSowingDepthIcon` composes the soil and ruler sources without another bitmap.
The barcode tag is decorative; `BarcodeValue` still renders the original exact
barcode and identifier. Plant-density grids remain precise diagrams at 1/4/9/16
positions. Information buttons, copy, numeric values, units, conditional cards,
price availability and physical raised-bed identifiers keep their behavior.

Seed and block attribute groups are extracted unchanged apart from artwork so
Storybook can render the actual page components. Review
`apps/www/Attributes/PublicAttributes` (Light, Dark, MissingAndZeroValues), and
`apps/www/Visuals/PublicVisuals` for the new icons at 24–96px. Examples are also in
the public component showcase and searchable in-game icon inventory.

Validation: scoped Biome and diff checks; UI/WWW typechecks; WWW and Storybook
production builds. Light, Dark and MissingAndZeroValues pass WCAG A/AA checks at
360px with all artwork decoding; layouts also fit 768px and 1280px. The information
dialog opens, retains its detail link and restores focus on Escape.
Production-built plant, variety, operation, seed and block routes were inspected
at 360px/1280px in both themes without horizontal overflow. The existing labeled
sunflower icon still communicates the block-price currency to screen readers.
The five images total 98,548 bytes. Storybook enables TypeScript-extension imports
so its no-emit typecheck can include the existing seed formatting module unchanged.

## Consistent tabs and exact sowing density

The plant archive's Popis tab uses the illustrated garden-plan icon alongside
its illustrated calendar. Both icons are decorative and 20px; the actual tab
component is shared with Storybook. Links retain search, sowing filter and view
behavior. Tab labels use foreground text for sufficient contrast in both
selected states. DESIGN.md records the matching-artwork rule for tab groups.
Plant-detail sowing/growth tabs and game inventory/raised-bed tabs were already
illustrated; text-only groups and consistently monochrome editor controls remain.

The approved soil-tile design is now the shared `PlantGridIcon`, used by public
plant/variety headers and sowing attributes, the advanced-sowing layout picker,
and persisted planting details in the game. It replaces the old 1/4/9/16 buckets
with an exact data-driven layout, including 25 and 36. A repeated planting-spot
SVG pattern keeps DOM size constant at higher densities; non-square counts use
an incomplete final row. Zero shows empty soil; invalid counts show empty soil
with an unknown-count label. Numeric counts remain beside compact icons.
The general-purpose Grid1/4/9/16 glyphs are unchanged.

The published catalogue checked on 2026-09-17 has default densities up to 16,
but carrot, radish and corn salad allow 5 cm minimum spacing in advanced sowing.
That fits 6x6 = 36 plants in a 30x30 cm field; 6 cm gives 5x5 = 25. Their default
7.5 cm spacing gives 4x4 = 16. The implementation supports higher counts too
without another artwork file or a new bucket.

Review `apps/www/Visuals/PlantVisualConsistency` (Light / Dark) for the actual tabs,
old/new density comparisons at 24–64px and real attribute cards. Shared
`packages/ui/Icons/GridIcons` (PlantDensities) includes 0, 17, 25, 36 and larger
counts. Dense variants also appear in the garden workspace showcase and game
icon inventory. Two transparent 384px WebP sources total 40,300 bytes. Exact
built-in generation prompts and style references are recorded in
[`density-prompts.json`](../packages/ui/src/GridIcons/assets/density-prompts.json).

Validation: scoped Biome and diff checks; UI/game/garden typechecks; all 14 UI
tests, including dense, partial-row, zero and invalid layouts; WWW and Storybook
production builds. The Light/Dark comparisons pass WCAG A/AA checks and decode
all artwork at 360/768/1280px, with exact counts and unique pattern IDs in all
30 icons. The shared examples cover empty, non-square and larger densities.
Production-built carrot and carrot-variety pages render the correct 16 spots
in both themes with no browser errors. The carrot page fits 360/1280px and its
information dialog retains the detail link and restores focus on Escape.
The tab changes also retain their verified mouse/keyboard navigation, search
and sowing-filter preservation in both themes.
