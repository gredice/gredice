'use client';

import { ImageGallery } from '@gredice/ui/ImageGallery';
import { Camera } from '@gredice/ui/icons';

const previewSize = 44;
const previewLimit = 3;

type RaisedBedPhotoPreviewImage = {
    src: string;
    alt: string;
};

interface RaisedBedPhotoPreviewProps {
    images: RaisedBedPhotoPreviewImage[];
    label: string;
    photoCount: number;
}

function getPhotoCountLabel(photoCount: number) {
    if (photoCount === 1) {
        return '1 fotografija';
    }

    if (photoCount > 1 && photoCount < 5) {
        return `${photoCount} fotografije`;
    }

    return `${photoCount} fotografija`;
}

export function RaisedBedPhotoPreview({
    images,
    label,
    photoCount,
}: RaisedBedPhotoPreviewProps) {
    const title =
        photoCount > 0
            ? `${label}: ${getPhotoCountLabel(photoCount)}`
            : `${label}: nema fotografija`;

    return (
        <span
            className="relative block h-11 w-12 shrink-0 overflow-visible"
            title={title}
        >
            {images.length > 0 ? (
                <ImageGallery
                    images={images}
                    previewWidth={previewSize}
                    previewHeight={previewSize}
                    previewVariant="stacked"
                    previewLimitBeforeStack={previewLimit}
                />
            ) : (
                <span className="flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xs">
                    <Camera className="size-4" aria-hidden="true" />
                    <span className="sr-only">{title}</span>
                </span>
            )}
        </span>
    );
}
