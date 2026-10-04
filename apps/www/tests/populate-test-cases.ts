/**
 * Write the public route list the Playwright suites iterate over.
 *
 * The sitemap is a Next.js route (`app/sitemap.ts`) rather than a file in
 * `public/`, so the routes are read from the same source model the route
 * renders. That also drops the XML round-trip: what the suites visit and what
 * the sitemap publishes cannot drift apart.
 *
 * Runs with `--conditions=react-server` so the `server-only` data loaders
 * resolve the same way they do inside the app.
 */

import { writeFile } from 'node:fs/promises';
import { getSitemapSourcePaths } from '../lib/sitemap/getSitemapSourcePaths.ts';

const paths = await getSitemapSourcePaths();
for (const path of paths) {
    console.info(`Found page: ${path}`);
}

await writeFile('./tests/sitemap-pages.json', JSON.stringify(paths));
