import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
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
            <Typography semiBold className="truncate">
                {label}
            </Typography>
        </Row>
    );
}
