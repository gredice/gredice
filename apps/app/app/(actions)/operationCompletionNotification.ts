import {
    operationCompletedNotificationType,
    raisedBedFieldPhotoCompletedNotificationType,
    raisedBedPhotoCompletedNotificationType,
} from '@gredice/js/notifications';

export function classifyOperationCompletionNotificationType({
    hasImage,
    raisedBedFieldId,
    visualReward,
}: {
    hasImage: boolean;
    raisedBedFieldId: number | null | undefined;
    visualReward: string | null | undefined;
}) {
    if (
        hasImage &&
        visualReward === 'photographyUpdate' &&
        raisedBedFieldId == null
    ) {
        return raisedBedPhotoCompletedNotificationType;
    }

    if (hasImage && raisedBedFieldId != null) {
        return raisedBedFieldPhotoCompletedNotificationType;
    }

    return operationCompletedNotificationType;
}
