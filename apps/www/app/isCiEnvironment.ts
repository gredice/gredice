export function isCiEnvironment() {
    return process.env.CI === 'true' || process.env.CI === '1';
}
