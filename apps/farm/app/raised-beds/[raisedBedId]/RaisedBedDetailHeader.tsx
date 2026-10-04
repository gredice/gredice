import { Typography } from '@gredice/ui/Typography';
import { HomeButton } from '../../../components/HomeButton';
import { RaisedBedPhotoPreview } from '../../../components/raised-beds/RaisedBedPhotoPreview';

export function RaisedBedDetailHeader({
    raisedBedId,
    physicalId,
    imageUrls,
}: {
    raisedBedId: number;
    physicalId: string | null;
    imageUrls: string[];
}) {
    const bedLabel = `Gredica ${physicalId ?? raisedBedId}`;
    const images = imageUrls.map((src, index) => ({
        src,
        alt: `${bedLabel}, fotografija ${index + 1}`,
    }));

    return (
        <div className="flex min-w-0 items-center gap-2 py-2">
            <HomeButton
                className="shrink-0"
                href="/raised-beds"
                title="Povratak na gredice"
            />
            <Typography
                component="h1"
                level="h5"
                semiBold
                className="min-w-0 [overflow-wrap:anywhere]"
            >
                {bedLabel}
            </Typography>
            <section
                aria-label={`Nedavne fotografije: ${bedLabel}`}
                className="ml-auto shrink-0 pl-6"
            >
                <RaisedBedPhotoPreview
                    images={images}
                    label={`Nedavne fotografije: ${bedLabel}`}
                    photoCount={images.length}
                />
            </section>
        </div>
    );
}
