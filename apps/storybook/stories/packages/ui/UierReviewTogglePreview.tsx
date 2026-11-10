import { UierReviewToggle } from '@gredice/ui/UierReview';
import { useState } from 'react';

export function UierReviewTogglePreview({
    initiallyEnabled = false,
}: {
    initiallyEnabled?: boolean;
}) {
    const [enabled, setEnabled] = useState(initiallyEnabled);

    return <UierReviewToggle checked={enabled} onCheckedChange={setEnabled} />;
}
