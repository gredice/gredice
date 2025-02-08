import { Row } from "@signalco/ui-primitives/Row";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ProfileAvatar } from "./ProfileAvatar";

export function ProfileInfo() {
    const currentUser = useCurrentUser();

    return (
        <Row spacing={2} className="pr-4">
            <ProfileAvatar />
            <Stack spacing={0.5}>
                <Typography level="body2" semiBold noWrap>
                    {currentUser.data?.displayName}
                </Typography>
                {currentUser.data?.userName !== currentUser.data?.displayName && (
                    <Typography level="body3" noWrap>
                        {currentUser.data?.userName}
                    </Typography>
                )}
            </Stack>
        </Row>
    )
}