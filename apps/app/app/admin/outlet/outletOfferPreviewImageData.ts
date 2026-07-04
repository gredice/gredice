export const outletOfferPreviewImageLimit = 3;

export function outletOfferPreviewImages(
    imageUrls: readonly (string | null | undefined)[] = [],
    limit = outletOfferPreviewImageLimit,
) {
    const uniqueImageUrls = new Set<string>();
    for (const imageUrl of imageUrls) {
        const normalizedImageUrl = imageUrl?.trim();
        if (normalizedImageUrl) {
            uniqueImageUrls.add(normalizedImageUrl);
        }
    }

    const normalizedImageUrls = [...uniqueImageUrls];
    const previewLimit = Math.max(0, limit);

    return {
        imageUrls: normalizedImageUrls.slice(0, previewLimit),
        hiddenImageCount: Math.max(
            0,
            normalizedImageUrls.length - previewLimit,
        ),
    };
}
