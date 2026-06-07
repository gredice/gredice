import { getEntitiesFormatted } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';
import { createOutletOfferAction } from '../actions';
import { OutletOfferForm } from '../OutletOfferForm';

export const dynamic = 'force-dynamic';

export default async function CreateOutletOfferPage() {
    await auth(['admin']);

    const plantSorts =
        await getEntitiesFormatted<EntityStandardized>('plantSort');

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                            },
                            { label: 'Nova outlet ponuda' },
                        ]}
                    />
                }
                heading="Nova outlet ponuda"
            />
            <OutletOfferForm
                action={createOutletOfferAction}
                plantSorts={plantSorts}
                submitLabel="Kreiraj ponudu"
            />
        </Stack>
    );
}
