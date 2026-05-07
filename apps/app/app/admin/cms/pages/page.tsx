import { getCmsPages } from '@gredice/storage';
import { Add } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import Link from 'next/link';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { CmsPagesTable } from './CmsPagesTable';

export const dynamic = 'force-dynamic';

export default async function CmsPagesPage() {
    await auth(['admin']);

    const pages = await getCmsPages();

    return (
        <Stack spacing={2}>
            <AdminPageHeader
                actions={
                    <Link href={KnownPages.CmsPageCreate}>
                        <Row
                            spacing={1}
                            className="text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Add className="size-4" />
                            <span>Nova stranica</span>
                        </Row>
                    </Link>
                }
            />
            <Card>
                <CardOverflow>
                    <CmsPagesTable pages={pages} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
