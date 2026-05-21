import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AccountUsersCard } from './AccountUsersCard';
import { ReceivedInvitationsCard } from './ReceivedInvitationsCard';

export function AccountUsersTab() {
    return (
        <Stack spacing={8}>
            <Typography level="h4" className="hidden md:block">
                👥 Korisnici
            </Typography>
            <Stack spacing={2}>
                <AccountUsersCard />
                <ReceivedInvitationsCard />
            </Stack>
        </Stack>
    );
}
