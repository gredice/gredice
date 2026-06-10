import { getCmsPages } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { CmsPageCreateDropdownButton } from './CmsPageCreateDropdownButton';
import { CmsPagesTable } from './CmsPagesTable';

export const dynamic = 'force-dynamic';

export default async function CmsPagesPage() {
    await auth(['admin']);

    const pages = await getCmsPages();

    return (
        <Stack spacing={4}>
            <AdminPageHeader actions={<CmsPageCreateDropdownButton />} />
            <Card>
                <CardOverflow>
                    <CmsPagesTable pages={pages} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
