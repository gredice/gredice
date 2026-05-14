/**
 * Splits content into main and additional sections using a delimiter.
 * The delimiter "<!-- more -->" is used to separate the main content from additional information.
 */
export function splitContentForExpansion(content: string | null | undefined): {
    mainContent: string;
    additionalContent?: string;
} {
    if (!content) {
        return { mainContent: '' };
    }

    const delimiter = '<!-- more -->';
    const parts = content.split(delimiter);

    if (parts.length === 1) {
        // No delimiter found, return all content as main
        return { mainContent: content };
    }

    return {
        mainContent: parts[0].trim(),
        additionalContent: parts.slice(1).join(delimiter).trim(),
    };
}

/**
 * Determines if content should be expandable based on its length or presence of delimiter.
 */
export function shouldMakeExpandable(
    content: string | null | undefined,
    maxLength = 500,
): boolean {
    if (!content) return false;

    // If content contains the delimiter, it should be expandable
    if (content.includes('<!-- more -->')) {
        return true;
    }

    // If content is longer than maxLength, it should be expandable
    return content.length > maxLength;
}
