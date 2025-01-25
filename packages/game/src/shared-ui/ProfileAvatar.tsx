import { Avatar } from "@signalco/ui-primitives/Avatar";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { initials } from "@signalco/js";

export function ProfileAvatar() {
    const currentUser = useCurrentUser();

    return (
        <Avatar>
            {initials(currentUser.data?.user?.displayName)}
        </Avatar>
    );
}