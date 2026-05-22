export function initials(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
        return '';
    }

    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }

    return `${parts[0]?.charAt(0) ?? ''}${parts.at(-1)?.charAt(0) ?? ''}`.toUpperCase();
}
