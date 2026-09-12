import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: ['public-profile.spec.tsx', 'avatar-profile-links.spec.tsx'],
    testIgnore: [],
    webServer: undefined,
    use: {
        ...config.use,
        ctViteConfig: {
            ...config.use?.ctViteConfig,
            resolve: {
                dedupe: ['nuqs', 'react', 'react-dom'],
                // Exercise profile data flow without starting the WebGL renderer.
                alias: [
                    {
                        find: './LandingPublicGardenViewer',
                        replacement: fileURLToPath(
                            new URL(
                                './playwright/LandingPublicGardenViewerStub.tsx',
                                import.meta.url,
                            ),
                        ),
                    },
                    {
                        find: './PublicGardenViewerDynamic',
                        replacement: fileURLToPath(
                            new URL(
                                './playwright/PublicGardenViewerStub.tsx',
                                import.meta.url,
                            ),
                        ),
                    },
                ],
            },
        },
    },
});
