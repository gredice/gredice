import type { PhotoEdit } from '@retusha/inline-editor';

/** Keep normal exports and resets byte-exact. Only re-encode oversized edits. */
export async function fitPhotoEdit(
    edit: PhotoEdit,
    original: File,
    maxBytes?: number,
): Promise<PhotoEdit> {
    if (
        maxBytes === undefined ||
        edit.file.size <= maxBytes ||
        edit.file === original
    )
        return edit;

    const bitmap = await createImageBitmap(edit.file);
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');
        let width = bitmap.width;
        let height = bitmap.height;
        for (;;) {
            canvas.width = width;
            canvas.height = height;
            context.imageSmoothingQuality = 'high';
            context.drawImage(bitmap, 0, 0, width, height);
            // WebP preserves transparency. Browsers without a WebP encoder return PNG.
            const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(
                    (result) =>
                        result
                            ? resolve(result)
                            : reject(new Error('Could not encode the photo.')),
                    'image/webp',
                    0.9,
                ),
            );
            if (blob.size <= maxBytes) {
                const stem = edit.file.name.replace(/\.[^.]+$/, '');
                const extension = blob.type === 'image/webp' ? 'webp' : 'png';
                return {
                    ...edit,
                    file: new File([blob], `${stem}.${extension}`, {
                        type: blob.type,
                        lastModified: edit.file.lastModified,
                    }),
                };
            }
            if (width === 1 && height === 1)
                throw new Error('Photo exceeds the upload limit.');
            const scale = 0.95 * Math.sqrt(maxBytes / blob.size);
            width = Math.max(1, Math.floor(width * scale));
            height = Math.max(1, Math.floor(height * scale));
        }
    } finally {
        bitmap.close();
    }
}
