import { useState } from 'react';
import { CmsPageCoverImageField } from '../app/admin/cms/pages/CmsPageCoverImageField';

const coverImage = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
        <rect width="400" height="200" fill="#dce8d8" />
        <circle cx="320" cy="40" r="25" fill="#2e6f40" />
    </svg>
`)}`;

export function CmsPageCoverImageFieldStory() {
    const [pointOfInterestX, setPointOfInterestX] = useState(50);
    const [pointOfInterestY, setPointOfInterestY] = useState(50);

    return (
        <CmsPageCoverImageField
            name="metaImageUrl"
            onChange={() => undefined}
            onPointOfInterestChange={(x, y) => {
                setPointOfInterestX(x);
                setPointOfInterestY(y);
            }}
            pointOfInterestX={pointOfInterestX}
            pointOfInterestXName="metaImagePoiX"
            pointOfInterestY={pointOfInterestY}
            pointOfInterestYName="metaImagePoiY"
            value={coverImage}
        />
    );
}
