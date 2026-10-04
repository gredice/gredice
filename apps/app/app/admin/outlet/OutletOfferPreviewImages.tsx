import { PlantOrSortImage } from '@gredice/ui/plants';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import Link from 'next/link';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { outletOfferPreviewImages } from './outletOfferPreviewImageData';

type OutletOfferPreviewImagesProps = {
    offerHref: Route;
    offerId: number;
    imageUrls: string[];
    plantSort: EntityStandardized | undefined;
    plantSortName: string;
};

function previewGridClassName(imageCount: number) {
    return cx(
        'grid size-20 shrink-0 gap-1 rounded-md border bg-muted/30 p-1 shadow-sm sm:size-24',
        imageCount > 2
            ? 'grid-cols-2 grid-rows-2'
            : imageCount > 1
              ? 'grid-cols-2'
              : 'grid-cols-1',
    );
}

function imageCountLabel(imageCount: number) {
    if (imageCount === 1) {
        return '1 slika';
    }

    const lastDigit = imageCount % 10;
    const lastTwoDigits = imageCount % 100;
    const plural =
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
            ? 'slike'
            : 'slika';

    return `${imageCount} ${plural}`;
}

export function OutletOfferPreviewImages({
    offerHref,
    offerId,
    imageUrls,
    plantSort,
    plantSortName,
}: OutletOfferPreviewImagesProps) {
    const preview = outletOfferPreviewImages(imageUrls);
    const attachedImageCount =
        preview.imageUrls.length + preview.hiddenImageCount;

    if (preview.imageUrls.length > 0) {
        return (
            <Link
                aria-label={`Otvori outlet ponudu #${offerId}: ${imageCountLabel(
                    attachedImageCount,
                )}`}
                className="block rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href={offerHref}
            >
                <span
                    className={previewGridClassName(preview.imageUrls.length)}
                >
                    {preview.imageUrls.map((imageUrl, index) => {
                        const isLastPreview =
                            index === preview.imageUrls.length - 1;

                        return (
                            <span
                                className={cx(
                                    'relative min-w-0 overflow-hidden rounded-sm bg-muted',
                                    index === 0 &&
                                        preview.imageUrls.length > 2 &&
                                        'row-span-2',
                                )}
                                key={imageUrl}
                            >
                                {/** biome-ignore lint/performance/noImgElement: Outlet offer images can be arbitrary admin-provided URLs. */}
                                <img
                                    alt={`Slika outlet ponude #${offerId} (${index + 1})`}
                                    className="size-full object-cover"
                                    loading="lazy"
                                    src={imageUrl}
                                />
                                {isLastPreview &&
                                preview.hiddenImageCount > 0 ? (
                                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/55 text-xs font-semibold text-background">
                                        +{preview.hiddenImageCount}
                                    </span>
                                ) : null}
                            </span>
                        );
                    })}
                </span>
            </Link>
        );
    }

    return (
        <Link
            aria-label={`Otvori outlet ponudu #${offerId}: slika sorte ${plantSortName}`}
            className="block rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={offerHref}
        >
            <span className="relative flex size-20 shrink-0 overflow-hidden rounded-md border bg-muted/30 shadow-sm sm:size-24">
                <PlantOrSortImage
                    plantSort={plantSort}
                    alt={`Slika sorte ${plantSortName}`}
                    fill
                    className="object-contain"
                    sizes="(min-width: 640px) 96px, 80px"
                />
            </span>
        </Link>
    );
}
