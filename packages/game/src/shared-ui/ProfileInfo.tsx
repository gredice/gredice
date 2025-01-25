import { Row } from "@signalco/ui-primitives/Row";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ProfileAvatar } from "./ProfileAvatar";

export function ProfileInfo() {
    const currentUser = useCurrentUser();

    return (
        <Row spacing={2}>
            <ProfileAvatar />
            <Stack spacing={0.5}>
                <Typography level="body2" semiBold className="leading-none">
                    {currentUser.data?.user?.displayName}
                </Typography>
                <Typography level="body3" className="leading-none">
                    {currentUser.data?.user?.email}
                </Typography>
            </Stack>
        </Row>
    )
}