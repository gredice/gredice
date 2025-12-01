// Mock for next/font/google to be used in Playwright component tests
// next/font/google doesn't work outside of Next.js build system

type FontOptions = {
    weight?: string | string[];
    subsets?: string[];
    display?: string;
    style?: string | string[];
    variable?: string;
};

type FontResult = {
    className: string;
    style: { fontFamily: string };
    variable?: string;
};

function createFontMock(fontName: string) {
    return (_options?: FontOptions): FontResult => ({
        className: `font-${fontName.toLowerCase().replace(/_/g, '-')}`,
        style: { fontFamily: fontName.replace(/_/g, ' ') },
    });
}

// Export all Google Fonts as mocks
// Add more fonts as needed
export const Spicy_Rice = createFontMock('Spicy_Rice');
export const Inter = createFontMock('Inter');
export const Roboto = createFontMock('Roboto');
export const Open_Sans = createFontMock('Open_Sans');
export const Lato = createFontMock('Lato');
export const Montserrat = createFontMock('Montserrat');
export const Poppins = createFontMock('Poppins');

// Default export for dynamic imports
export default new Proxy({}, {
    get: (_target, prop: string) => createFontMock(prop),
});
