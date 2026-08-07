import { MapPin } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { RaisedBedPhotoPreview } from './RaisedBedPhotoPreview';
import type { FarmScheduleRaisedBedPhotoPreview } from './scheduleData';

interface RaisedBedScheduleGroupHeaderProps {
    physicalId: string | null;
    photoPreview?: FarmScheduleRaisedBedPhotoPreview;
}

export function RaisedBedScheduleGroupHeader({
    physicalId,
    photoPreview,
}: RaisedBedScheduleGroupHeaderProps) {
    const label = physicalId ? `Gr ${physicalId}` : 'Gredica bez fizičkog ID-a';
    const preview = photoPreview ?? { images: [], photoCount: 0 };

    return (
        <Row spacing={2} className="min-w-0 items-center">
            <RaisedBedPhotoPreview
                images={preview.images}
                label={label}
                photoCount={preview.photoCount}
            />
            <span className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-md bg-primary/10 px-2.5 text-base font-bold text-primary [overflow-wrap:anywhere]">
                <MapPin aria-hidden className="size-4 shrink-0" />
                {label}
            </span>
        </Row>
    );
}
