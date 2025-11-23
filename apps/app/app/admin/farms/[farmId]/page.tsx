import { getFarm } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormFields } from '../../../../components/shared/fields/FormFields';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { FarmSlackChannelForm } from './FarmSlackChannelForm';
import { FarmSnowAccumulationForm } from './FarmSnowAccumulationForm';
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
                        {
                            name: 'Slack kanal',
                            value: farm.slackChannelId ?? '—',
                        },
                        {
                            name: 'Snijeg',
                            value: `${farm.snowAccumulation} cm`,
                        },
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
                <Card>
                    <CardHeader>
                        <CardTitle>Slack kanal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <FarmSlackChannelForm
                            farmId={farmId}
                            slackChannelId={farm.slackChannelId}
                        />
                        <p className="text-sm text-muted-foreground">
                            Koristimo ovaj kanal za administrativne obavijesti o
                            promjenama radnji na farmi.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Snijeg</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <FarmSnowAccumulationForm
                            farmId={farmId}
                            snowAccumulation={farm.snowAccumulation}
                        />
                        <p className="text-sm text-muted-foreground">
                            Trenutna količina snijega na farmi. Automatski se
                            ažurira svakih sat vremena.
                        </p>
                    </CardContent>
                </Card>
                <FarmUsersCard farmId={farmId} />
            </div>
        </Stack>
    );
}
