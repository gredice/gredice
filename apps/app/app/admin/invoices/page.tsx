import { Card, CardOverflow } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Add } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { InvoicesTable } from './InvoicesTable';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <IconButton
                        aria-label="Nova ponuda"
                        href={KnownPages.CreateInvoice}
                        title="Nova ponuda"
                        variant="solid"
                    >
                        <Add className="size-5" />
                    </IconButton>
                }
            />
            <Card>
                <CardOverflow>
                    <InvoicesTable />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
