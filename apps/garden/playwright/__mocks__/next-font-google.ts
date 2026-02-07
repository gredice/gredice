// Mock for next/font/google used in Playwright component tests
export function Inter() {
    return {
        className: 'inter-mock',
        variable: '--font-inter',
        style: { fontFamily: 'Inter, sans-serif' },
    };
}
