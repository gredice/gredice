# HUD artwork

`tutorial-task-list.png` is the selected tutorial clipboard artwork. Its chunky
geometry, green clip and warm wood follow `inventory-backpack.webp` and
`shopping-basket.webp`. The built-in image-generation prompt is recorded in
`tutorial-task-list.prompt.json`. The PNG has real transparency and keeps the
runtime path used by the tutorial HUD and Storybook inventory.

`pnpm --filter garden generate-playwright:tutorial-task-list-icon` renders the
older `FieldworkClipboard` model into Playwright's test output directory as
`tutorial-task-list-model-preview.png`. It remains available for model review
without overwriting the selected HUD artwork.

The block options artwork (`block-expand`, `block-rotate`, `block-recycle`,
`block-delete`, `block-move`, `action-confirm` and `action-cancel`) uses the
backpack, basket and clipboard as style references. Each WebP has its prompt
and processing in the `.prompt.json` of the same name, and the game shows them
on candy medallions (`packages/game/src/blockOptions/BlockOptionsArt.tsx`).
