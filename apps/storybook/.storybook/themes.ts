import { create } from 'storybook/theming';

const fontBase =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const fontCode =
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace';

export const managerTheme = create({
    base: 'light',
    brandTitle: 'Gredice Storybook',
    brandUrl: 'https://www.gredice.com',
    brandTarget: '_blank',
    brandImage: '/brand.svg',
    colorPrimary: '#7c3aed',
    colorSecondary: '#6d28d9',
    appBg: '#faf5ff',
    appContentBg: '#ffffff',
    appPreviewBg: '#faf5ff',
    appBorderColor: '#ddd6fe',
    appBorderRadius: 8,
    barBg: '#ffffff',
    barHoverColor: '#6d28d9',
    barSelectedColor: '#7c3aed',
    barTextColor: '#4c1d95',
    inputBg: '#ffffff',
    inputBorder: '#c4b5fd',
    inputBorderRadius: 6,
    inputTextColor: '#2e1065',
    textColor: '#2e1065',
    textInverseColor: '#ffffff',
    fontBase,
    fontCode,
});

export const docsTheme = create({
    base: 'light',
    brandTitle: 'Gredice Storybook',
    brandUrl: 'https://www.gredice.com',
    brandTarget: '_blank',
    brandImage: '/brand.svg',
    colorPrimary: '#2b1a0f',
    colorSecondary: '#245632',
    appBg: '#fefaf7',
    appContentBg: '#fefaf7',
    appPreviewBg: '#fefaf7',
    appBorderColor: '#eee4dc',
    appBorderRadius: 8,
    barBg: '#ffffff',
    barHoverColor: '#245632',
    barSelectedColor: '#245632',
    barTextColor: '#2b1a0f',
    inputBg: '#ffffff',
    inputBorder: '#eee4dc',
    inputBorderRadius: 6,
    inputTextColor: '#2b1a0f',
    textColor: '#2b1a0f',
    textInverseColor: '#ffffff',
    fontBase,
    fontCode,
});
