export function decodeUriComponentSafe(value: string) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        console.error('Failed to decode URI component', error);
        return value;
    }
}
