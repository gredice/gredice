import { UierReviewButton } from '@gredice/ui/UierReview';
import { useState } from 'react';

export function UierReviewButtonPreview({
    initiallyEnabled = false,
}: {
    initiallyEnabled?: boolean;
}) {
    const [enabled, setEnabled] = useState(initiallyEnabled);
    return <UierReviewButton checked={enabled} onCheckedChange={setEnabled} />;
}
