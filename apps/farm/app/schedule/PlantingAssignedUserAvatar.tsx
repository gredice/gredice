import { safeUserDisplayName } from '@gredice/js/userDisplayName';
import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import { UserAvatar } from '@gredice/ui/UserAvatar';

interface PlantingAssignedUserAvatarProps {
    assignedUserByFieldIdPromise: Promise<
        Map<number, RaisedBedFieldAssignableFarmUser>
    >;
    fieldId: number;
}

export async function PlantingAssignedUserAvatar({
    assignedUserByFieldIdPromise,
    fieldId,
}: PlantingAssignedUserAvatarProps) {
    const assignedUserByFieldId = await assignedUserByFieldIdPromise;
    const assignedUser = assignedUserByFieldId.get(fieldId);

    if (!assignedUser) {
        return null;
    }

    return (
        <div
            className="shrink-0"
            title={`Dodijeljeno: ${safeUserDisplayName(assignedUser.displayName ?? assignedUser.userName)}`}
        >
            <UserAvatar
                achievementCount={assignedUser.achievementCount}
                avatarUrl={assignedUser.avatarUrl}
                displayName={safeUserDisplayName(
                    assignedUser.displayName ?? assignedUser.userName,
                )}
                className="size-7 rounded-full"
            />
        </div>
    );
}
