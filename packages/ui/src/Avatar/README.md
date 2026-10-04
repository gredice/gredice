# Game avatar artwork

The collection contains 29 built-in choices: the original two farmers plus 27
new gardeners, animals and fantasy characters. The sunflower is the Gredice
mascot and is deliberately excluded from the selectable collection.

All portraits share the chunky 3D style of `GameIcons/assets/profile.webp`.
Transparent square images include padding to keep hats, ears, wings and
shoulders inside the circular avatar crop. Each optimized WebP is 512px square.
The original prompts are in `assets/prompts.json`; the new collection's prompts
and processing settings are in `assets/collection-prompts.json`.

## Saved choices and shared rendering

`avatarCatalog.ts` owns the stable IDs, Croatian labels, categories, profile URL
values and bundled artwork. `farmerAvatarUrls` retains the exact two legacy CDN
URLs. `resolveAvatarSource` maps registered URLs to bundled artwork at render
time; the CDN URL is a stable profile value, not a required network fetch.
Never save build-specific static asset URLs in user profiles. Unknown URLs and
custom images pass through unchanged.

Both `Avatar` and `UserAvatar` use the resolver, so saved selections display in
Garden, WWW public profiles, Admin and Farm without a data migration. Initials,
profile links and achievement levels retain their existing behavior.

## Picker and previews

`AvatarSelectionMenu` retains its trigger and `onChange` contract and opens the
shared responsive Modal as a gallery. Pass the current `avatarUrl` to highlight
the saved choice. The picker groups portraits into gardeners, animals and
fantasy characters; selecting a portrait closes it and emits the stable URL.
Selecting `Prazno` emits `null` and restores initials. Existing game and Admin
profile mutations still handle persistence and error reporting.

Review `packages/ui/Data Display/UserAvatar` (Collection and Collection Dark)
for all portraits at compact sizes with level badges. The AvatarSelectionMenu
Gallery stories demonstrate selection, and the Garden workspace showcase shows
a representative set in context. Garden component tests cover all bundled
images, legacy/custom URLs, stable selection values, keyboard dismissal and
mobile selection inside the profile modal.
