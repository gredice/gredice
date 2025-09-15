import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { auth } from '../../../lib/auth/auth';
import { RaisedBedsTableCard } from '../accounts/[accountId]/RaisedBedsTableCard';
import { RaisedBedsFilters } from './RaisedBedsFilters';

export const dynamic = 'force-dynamic';

export default async function RaisedBedsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const params = await searchParams;

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>
                Gredice
            </Typography>

            <RaisedBedsFilters />

            <RaisedBedsTableCard searchParams={params} />
        </Stack>
    );
}
