export const adminAppTitle = 'Gredice Admin';

export function formatAdminDocumentTitle(title: string | null | undefined) {
    const normalizedTitle = title?.trim();

    if (!normalizedTitle || normalizedTitle === adminAppTitle) {
        return adminAppTitle;
    }

    if (normalizedTitle.endsWith(` | ${adminAppTitle}`)) {
        return normalizedTitle;
    }

    return `${normalizedTitle} | ${adminAppTitle}`;
}
