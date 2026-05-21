import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { ProfileAvatar } from './ProfileAvatar';

export function ProfileInfo() {
    const currentUser = useCurrentUser();

    return (
        <Row spacing={2} className="pr-4">
            <ProfileAvatar />
            <Stack className="overflow-hidden">
                <Typography
                    level="body2"
                    semiBold
                    noWrap
                    title={currentUser.data?.displayName}
                >
                    {currentUser.data?.displayName}
                </Typography>
                {currentUser.data?.userName !==
                    currentUser.data?.displayName && (
                    <Typography level="body3" noWrap>
                        {currentUser.data?.userName}
                    </Typography>
                )}
            </Stack>
        </Row>
    );
}
