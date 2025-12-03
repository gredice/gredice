import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NotificationsTableCard } from '../../../../components/notifications/NotificationsTableCard';
import { auth } from '../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>
                Obavijesti
            </Typography>
            <NotificationsTableCard showAccountLabels limit={50} />
        </Stack>
    );
}
