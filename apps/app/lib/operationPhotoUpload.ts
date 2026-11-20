export const MAX_OPERATION_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

export function isGrediceWebsiteImage(src: string) {
    let url: URL;
    try {
        url = new URL(src);
    } catch {
        return false;
    }
    return (
        !url.username &&
        !url.password &&
        (url.origin === 'https://cdn.gredice.com' ||
            url.origin === 'https://www.gredice.com')
    );
}
