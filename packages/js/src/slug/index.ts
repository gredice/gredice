/**
 * Converts a string to a URL-friendly slug.
 * Handles Croatian special characters (đ, ž, č, ć, š) and Unicode diacritics.
 *
 * @param text - The text to convert to a slug
 * @returns A URL-friendly slug
 *
 * @example
 * slugify("Adventski kalendar 2025") // "adventski-kalendar-2025"
 * slugify("Čokolada i Šećer") // "cokolada-i-secer"
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/ž/g, 'z')
        .replace(/č/g, 'c')
        .replace(/ć/g, 'c')
        .replace(/š/g, 's')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
