import { RaisedBedScheduleGroupHeader } from './RaisedBedScheduleGroupHeader';
import type {
    FarmScheduleDayData,
    FarmScheduleRaisedBedPhotoPreview,
    FarmScheduleRaisedBedPhotoPreviewImage,
} from './scheduleData';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];

interface RaisedBedScheduleGroupHeaderWithPhotosProps {
    physicalId: string | null;
    raisedBeds: FarmRaisedBed[];
    raisedBedPhotoPreviewByIdPromise: Promise<
        Map<number, FarmScheduleRaisedBedPhotoPreview>
    >;
}

function getGroupPhotoPreview(
    raisedBeds: FarmRaisedBed[],
    raisedBedPhotoPreviewById: Map<number, FarmScheduleRaisedBedPhotoPreview>,
) {
    const images: FarmScheduleRaisedBedPhotoPreviewImage[] = [];
    const seenImageUrls = new Set<string>();
    const photoCount = raisedBeds.reduce((count, raisedBed) => {
        const preview = raisedBedPhotoPreviewById.get(raisedBed.id);
        for (const image of preview?.images ?? []) {
            if (seenImageUrls.has(image.src)) {
                continue;
            }

            seenImageUrls.add(image.src);
            if (images.length < 3) {
                images.push(image);
            }
        }

        return count + (preview?.photoCount ?? 0);
    }, 0);

    return { images, photoCount };
}

export async function RaisedBedScheduleGroupHeaderWithPhotos({
    physicalId,
    raisedBeds,
    raisedBedPhotoPreviewByIdPromise,
}: RaisedBedScheduleGroupHeaderWithPhotosProps) {
    const raisedBedPhotoPreviewById = await raisedBedPhotoPreviewByIdPromise;

    return (
        <RaisedBedScheduleGroupHeader
            physicalId={physicalId}
            photoPreview={getGroupPhotoPreview(
                raisedBeds,
                raisedBedPhotoPreviewById,
            )}
        />
    );
}
