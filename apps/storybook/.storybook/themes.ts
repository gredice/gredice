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
    colorPrimary: '#111111',
    colorSecondary: '#000000',
    appBg: '#f7f7f7',
    appContentBg: '#ffffff',
    appPreviewBg: '#f7f7f7',
    appBorderColor: '#e5e5e5',
    appBorderRadius: 8,
    barBg: '#ffffff',
    barHoverColor: '#111111',
    barSelectedColor: '#111111',
    barTextColor: '#111111',
    inputBg: '#ffffff',
    inputBorder: '#d4d4d4',
    inputBorderRadius: 6,
    inputTextColor: '#111111',
    textColor: '#111111',
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
