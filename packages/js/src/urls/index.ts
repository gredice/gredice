export * from './gardenUrls';

export function isAbsoluteUrl(value: string | null | undefined) {
    return /^https?:\/\//.test(value ?? '');
}
