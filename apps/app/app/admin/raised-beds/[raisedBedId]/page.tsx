import { getRaisedBed } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { NotificationsTableCard } from '../../../../components/notifications/NotificationsTableCard';
import { RaisedBedFieldsTable } from '../../../../components/raised-beds/RaisedBedFieldsTable';
import { Field } from '../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../components/shared/fields/FieldSet';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { OperationsTableCard } from './OperationsTableCard';

export const dynamic = 'force-dynamic';

export default async function RaisedBedPage({
    params,
}: {
    params: Promise<{ raisedBedId: number }>;
}) {
    const { raisedBedId } = await params;
    await auth(['admin']);
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        notFound();
    }

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Stack spacing={2}>
                    <Breadcrumbs
                        items={[
                            { label: 'Računi', href: KnownPages.Accounts },
                            {
                                label: raisedBed.accountId ?? 'Nepoznato',
                                href: raisedBed.accountId
                                    ? KnownPages.Account(raisedBed.accountId)
                                    : undefined,
                            },
                            { label: 'Vrtovi' },
                            {
                                label: raisedBed.gardenId ?? 'Nepoznato',
                                href: raisedBed.gardenId
                                    ? KnownPages.Garden(raisedBed.gardenId)
                                    : undefined,
                            },
                            { label: 'Gredice' },
                            { label: raisedBed?.id },
                        ]}
                    />
                    <Typography level="h1" semiBold>
                        Gredica
                    </Typography>
                </Stack>
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID" value={raisedBed?.id} mono />
                        <Field name="Naziv" value={raisedBed?.name} />
                        <Field
                            name="Fizička oznaka"
                            value={raisedBed?.physicalId}
                        />
                        <Field
                            name="Datum kreiranja"
                            value={raisedBed?.createdAt}
                        />
                    </FieldSet>
                </Stack>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Polja</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Suspense>
                            <RaisedBedFieldsTable raisedBedId={raisedBed.id} />
                        </Suspense>
                    </CardOverflow>
                </Card>
                {raisedBed.accountId && raisedBed.gardenId && (
                    <>
                        <OperationsTableCard
                            accountId={raisedBed.accountId}
                            gardenId={raisedBed.gardenId}
                            raisedBedId={raisedBed.id}
                        />
                        <NotificationsTableCard
                            accountId={raisedBed.accountId}
                            gardenId={raisedBed.gardenId}
                            raisedBedId={raisedBed.id}
                        />
                    </>
                )}
            </div>
        </Stack>
    );
}
