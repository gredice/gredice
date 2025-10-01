import { getFarm } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormFields } from '../../../../components/shared/fields/FormFields';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { FarmUsersCard } from './FarmUsersCard';

export const dynamic = 'force-dynamic';

export default async function FarmPage({
    params,
}: {
    params: Promise<{ farmId: number }>;
}) {
    const { farmId } = await params;
    await auth(['admin']);

    const farm = await getFarm(farmId);

    if (!farm) {
        notFound();
    }

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs
                    items={[
                        { label: 'Farme', href: KnownPages.Farms },
                        { label: farm.name },
                    ]}
                />
                <Typography level="h1" semiBold>
                    Farma
                </Typography>
                <FormFields
                    fields={[
                        { name: 'ID farme', value: farm.id, mono: true },
                        { name: 'Naziv', value: farm.name },
                        { name: 'Latitude', value: farm.latitude },
                        { name: 'Longitude', value: farm.longitude },
                        { name: 'Datum kreiranja', value: farm.createdAt },
                        { name: 'Datum ažuriranja', value: farm.updatedAt },
                        { name: 'Obrisana', value: farm.isDeleted },
                    ]}
                />
                <Typography level="body2">
                    <Link
                        className="text-primary hover:underline"
                        href={`https://vrt.gredice.com/farme/${farm.id}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Otvori javni prikaz farme
                    </Link>
                </Typography>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FarmUsersCard farmId={farmId} />
            </div>
        </Stack>
    );
}
