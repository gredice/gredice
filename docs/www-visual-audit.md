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
  verification, discounts and precise measurement/spacing/grid symbols.
- The outline/filled heart on `PublicGardenLikeButton`: its appearance communicates
  selected state. Preserve that distinction instead of substituting a static image.
- Physical raised-bed identifiers and the exact plant-grid symbols. Shared
  physical-ID rendering was not changed.
- Brand marks, mascot artwork, actual catalog photographs, garden previews,
  3D models, avatars and achievement awards.
- Pet catalog routine/capacity symbols and the unindexed `/development` resource
  menu remain compact technical mnemonics. A dedicated pet-care or developer
  artwork collection is lower priority; this pass does not generate one image
  for every diagnostic entry.

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
