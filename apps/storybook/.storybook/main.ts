import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs-vite';

const storybookConfigDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(storybookConfigDir, '..');
const repoRoot = resolve(appRoot, '../..');
const nextImageMockPath = resolve(storybookConfigDir, 'next-image.mock.tsx');
const localDomain = 'storybook.dev.gredice.test';

const config: StorybookConfig = {
    stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
    staticDirs: [
        '../public',
        { from: '../../www/public/assets/plants', to: '/assets/plants' },
    ],
    addons: [
        '@storybook/addon-docs',
        '@storybook/addon-a11y',
        '@storybook/addon-mcp',
    ],
    framework: {
        name: '@storybook/nextjs-vite',
        options: {
            nextConfigPath: resolve(appRoot, 'next.config.ts'),
        },
    },
    typescript: {
        reactDocgen: 'react-docgen-typescript',
        reactDocgenTypescriptOptions: {
            tsconfigPath: resolve(appRoot, 'tsconfig.json'),
            include: [
                '../../packages/ui/src/**/*.tsx',
                '../../packages/game/src/hud/**/*.tsx',
                '../app/components/admin/cards/FactCard.tsx',
                '../app/components/raised-beds/RaisedBedFieldCard.tsx',
                '../app/components/shared/ServerActionButton.tsx',
                '../app/components/shared/ServerActionIconButton.tsx',
                '../app/components/shared/fields/Field.tsx',
                '../app/components/shared/fields/FieldSet.tsx',
                '../app/components/shared/fields/FormFields.tsx',
                '../app/components/shared/placeholders/NoDataPlaceholder.tsx',
                '../farm/app/schedule/FarmScheduleSectionSkeleton.tsx',
                '../farm/app/schedule/ScheduleDateNavigation.tsx',
                '../farm/components/HomeButton.tsx',
                '../garden/components/Logotype.tsx',
                '../www/app/sjetva/SowingCalendarPreview.tsx',
                '../www/components/Logotype.tsx',
                '../www/components/attributes/DetailCard.tsx',
                '../www/components/shared/ExpandableText.tsx',
                '../www/components/shared/ItemCard.tsx',
                '../www/components/shared/ListCollapsable.tsx',
                '../www/components/social/SocialCard.tsx',
            ],
            shouldExtractLiteralValuesFromEnum: true,
            shouldRemoveUndefinedFromOptional: true,
            propFilter: (prop) =>
                prop.parent
                    ? !prop.parent.fileName.includes('node_modules')
                    : true,
        },
    },
    docs: {
        defaultName: 'Documentation',
    },
    core: {
        allowedHosts: [localDomain],
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
                    localDomain,
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
