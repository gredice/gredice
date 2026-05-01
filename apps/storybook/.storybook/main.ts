import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs-vite';

const storybookConfigDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(storybookConfigDir, '..');
const repoRoot = resolve(appRoot, '../..');
const nextImageMockPath = resolve(storybookConfigDir, 'next-image.mock.tsx');

const config: StorybookConfig = {
    stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
    addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-mcp'],
    framework: {
        name: '@storybook/nextjs-vite',
        options: {
            nextConfigPath: resolve(appRoot, 'next.config.ts'),
        },
    },
    docs: {
        defaultName: 'Documentation',
    },
    core: {
        allowedHosts: ['storybook.gredice.test'],
    },
    viteFinal: async (viteConfig) => {
        viteConfig.plugins = [
            {
                name: 'gredice-storybook-next-image-mock',
                enforce: 'pre',
                resolveId(source) {
                    if (source === 'next/image') {
                        return nextImageMockPath;
                    }

                    return null;
                },
            },
            ...(viteConfig.plugins ?? []),
        ];

        viteConfig.server = viteConfig.server ?? {};
        if (viteConfig.server.allowedHosts !== true) {
            viteConfig.server.allowedHosts = [
                ...new Set([
                    ...(viteConfig.server.allowedHosts ?? []),
                    'storybook.gredice.test',
                ]),
            ];
        }

        viteConfig.server.fs = viteConfig.server.fs ?? {};
        viteConfig.server.fs.allow = [
            ...(viteConfig.server.fs.allow ?? []),
            repoRoot,
        ];

        return viteConfig;
    },
};

export default config;
