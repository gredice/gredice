import { accessSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Node has no image bundler. Give component imports the URL-shaped asset export
// used by Vite; the Storybook and Playwright checks verify actual image decoding.
registerHooks({
    load(url, context, nextLoad) {
        if (url.startsWith('file:') && url.endsWith('.webp')) {
            // Missing artwork must still fail the test run.
            accessSync(new URL(url));
            return {
                format: 'module',
                source: `export default ${JSON.stringify(url)};`,
                shortCircuit: true,
            };
        }
        return nextLoad(url, context);
    },
});
