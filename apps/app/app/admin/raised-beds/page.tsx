import { Stack } from '@signalco/ui-primitives/Stack';
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
            <RaisedBedsFilters />

            <RaisedBedsTableCard searchParams={params} />
        </Stack>
    );
}
