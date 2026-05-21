export function camelToSentenceCase(value: string) {
    const withSpaces = value.replace(/([A-Z])/g, ' $1');
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
