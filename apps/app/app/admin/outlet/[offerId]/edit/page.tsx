import { getEntitiesFormatted, getOutletOffer } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import type { EntityStandardized } from '../../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import { updateOutletOfferAction } from '../../actions';
import { OutletOfferForm } from '../../OutletOfferForm';

export const dynamic = 'force-dynamic';

export default async function EditOutletOfferPage({
    params,
}: {
    params: Promise<{ offerId: string }>;
}) {
    await auth(['admin']);

    const { offerId } = await params;
    const id = Number.parseInt(offerId, 10);
    const [offer, plantSorts] = await Promise.all([
        Number.isFinite(id) ? getOutletOffer(id) : null,
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);

    if (!offer) {
        notFound();
    }

    const updateAction = updateOutletOfferAction.bind(null, offer.id);

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.Outlet,
                            },
                            {
                                label: `Outlet ponuda ${offer.id}`,
                                href: KnownPages.OutletOffer(offer.id),
                            },
                            { label: 'Uredi' },
                        ]}
                    />
                }
                heading={`Uredi outlet ponudu ${offer.id}`}
            />
            <OutletOfferForm
                action={updateAction}
                offer={offer}
                plantSorts={plantSorts}
                submitLabel="Spremi promjene"
            />
        </Stack>
    );
}
