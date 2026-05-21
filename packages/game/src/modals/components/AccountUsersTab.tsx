import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AccountUsersCard } from './AccountUsersCard';
import { ReceivedInvitationsCard } from './ReceivedInvitationsCard';

export function AccountUsersTab() {
    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                👥 Korisnici
            </Typography>
            <Stack spacing={1}>
                <AccountUsersCard />
                <ReceivedInvitationsCard />
            </Stack>
        </Stack>
    );
}
