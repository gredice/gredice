export * from './gardenUrls';
export * from './safeUrls';

export function isAbsoluteUrl(value: string | null | undefined) {
    return /^https?:\/\//.test(value ?? '');
}
