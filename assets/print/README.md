# Print assets

Leaflets and other printed pieces, kept as source so they can be edited and re-rendered.

Each asset is one folder:

```text
assets/print/<name>/
  index.html            source: one fixed-size page, copy and layout
  images/               illustrations used by the page
  illustrations.json    how the illustrations were generated (prompts, style references)
  <name>.png            print-ready render, committed so it can be used directly
```

## Assets

| Asset | Format | Render |
| --- | --- | --- |
| [green-tomatoes-leaflet](./green-tomatoes-leaflet/index.html): how to ripen green tomatoes in a paper bag | 10×15 cm photo print, portrait | [green-tomatoes-leaflet.png](./green-tomatoes-leaflet/green-tomatoes-leaflet.png) |

## Render

Run from the repo root after `pnpm install`:

```bash
pnpm print:render                          # every asset
pnpm print:render green-tomatoes-leaflet   # one asset
```

The script opens `index.html` in the `www` app's Playwright Chromium and writes `<name>.png` at the page's pixel size. If Chromium is missing, install it with `pnpm --filter www exec playwright install chromium`.

Rendering needs network access, because the pages load Montserrat and Patrick Hand from Google Fonts. The script refuses to write a PNG when an image did not load, when a font face the text needs (by weight, style, or character range) did not load, when text extends past any page edge, or when content overflows the page. A render never silently falls back to system fonts or clips text.

Two renders of the same source can differ by sub-pixel text anti-aliasing, which is not visible in print. Commit a re-rendered PNG only when the source changed.

To preview while editing, open `index.html` in a browser.

## Page conventions

- The page is the single element marked `data-print-page`, with a fixed pixel `width` and `height` and `overflow: hidden`. Its size is the output size.
- 10×15 cm photo paper is 1200×1800 px (300 dpi). Keep text and logos 84 px (7 mm) from every edge: borderless photo prints crop a few millimetres.
- Body text is at least 38 px (about 9 pt in print).
- Use the brand basics: Montserrat, ground `#FEFAF5`, ink `#2A1D0F`, green `#2E6F40`, and the logotype from [`assets/brand`](../brand/gredice-logotype.svg). Croatian copy addresses the reader as "ti", like the public site.
- Reference images and the logotype with relative paths so the page works from a file URL.

## Add a new asset

1. Copy an existing folder to `assets/print/<new-name>/` and delete its rendered PNG.
2. Edit the copy and layout in `index.html`.
3. Generate illustrations (below), then run `pnpm print:render <new-name>`.
4. Add the asset to the table above and commit the folder, including the rendered PNG.

## Illustrations

Illustrations follow the low-poly game art used on the public site. `illustrations.json` records the style reference, the shared style text, and the prompt for each image.

The green-tomatoes illustrations were generated with the Codex CLI's built-in image generation. To generate a new set the same way, work in a temporary folder outside the repo:

```bash
sips -s format png apps/www/public/assets/shopping-basket/shopping-basket.webp --out /tmp/print-art/style-reference.png
cd /tmp/print-art
codex exec --skip-git-repo-check -s workspace-write -i style-reference.png - < prompt.txt
```

`prompt.txt` asks for the images by filename: the shared style text first, then one numbered description per image. Pass the prompt on stdin as shown; `-i` consumes a prompt given as an argument.

Generated images are not reproducible: a new run gives new artwork, so regenerate only when the artwork should change. Then prepare each image for the page:

```bash
pnpm print:prepare-image /tmp/print-art/hero-bag.png assets/print/<name>/images/hero-bag.png
```

This clears the colour that generators leave in fully transparent pixels and trims the transparent margins, so `object-fit: contain` sizes the artwork rather than its empty border. Partially transparent pixels are kept as they are.
