import { GameProfileIcon } from '@gredice/ui/GameIcons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AccountUsersCard } from './AccountUsersCard';
import { ReceivedInvitationsCard } from './ReceivedInvitationsCard';

export function AccountUsersTab() {
    return (
        <Stack spacing={8}>
            <Typography
                level="h4"
                className="hidden md:flex items-center gap-2"
            >
                <GameProfileIcon aria-hidden className="size-8 shrink-0" />
                Korisnici
            </Typography>
            <Stack spacing={2}>
                <AccountUsersCard />
                <ReceivedInvitationsCard />
            </Stack>
        </Stack>
    );
}
