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
            title={`Dodijeljeno: ${assignedUser.displayName ?? assignedUser.userName}`}
        >
            <UserAvatar
                avatarUrl={assignedUser.avatarUrl}
                displayName={assignedUser.displayName ?? assignedUser.userName}
                className="size-7 rounded-full"
            />
        </div>
    );
}
