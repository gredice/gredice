import { Avatar } from "@signalco/ui-primitives/Avatar";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { initials } from "@signalco/js";
import { cx } from "@signalco/ui-primitives/cx";

export function ProfileAvatar({ variant }: { variant?: 'transparentOnMobile' | 'normal' }) {
    const currentUser = useCurrentUser();

    return (
        <Avatar className={cx(variant === 'transparentOnMobile' && "border-none bg-transparent md:bg-muted md:border")}>
            {initials(currentUser.data?.displayName ?? '')}
        </Avatar>
    );
}