import {
    getAccounts,
    getAllRaisedBeds,
    getEntitiesFormatted,
    getGardens,
    getOperationById,
} from '@gredice/storage';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import { Field } from '../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../components/shared/fields/FieldSet';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function OperationDetailsPage({
    params,
}: {
    params: Promise<{ operationId: string }>;
}) {
    const { operationId } = await params;
    const operationIdNumber = parseInt(operationId, 10);
    if (Number.isNaN(operationIdNumber)) {
        return notFound();
    }

    await auth(['admin']);

    let operation: Awaited<ReturnType<typeof getOperationById>>;
    try {
        operation = await getOperationById(operationIdNumber);
    } catch {
        return notFound();
    }

    const [operationsData, accounts, gardens, raisedBeds] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation'),
        getAccounts(),
        getGardens(),
        getAllRaisedBeds(),
    ]);

    const operationDetails = operationsData?.find(
        (op) => op.id === operation.entityId,
    );
    const accountUsers = accounts
        .find((a) => a.id === operation.accountId)
        ?.accountUsers.map((u) => u.user.userName)
        .join(', ');
    const gardenName = operation.gardenId
        ? gardens.find((g) => g.id === operation.gardenId)?.name
        : undefined;
    const raisedBed = operation.raisedBedId
        ? raisedBeds.find((rb) => rb.id === operation.raisedBedId)
        : undefined;
    const raisedBedField =
        raisedBed && operation.raisedBedFieldId
            ? raisedBed.fields.find((f) => f.id === operation.raisedBedFieldId)
            : undefined;

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs
                    items={[
                        { label: 'Radnje', href: KnownPages.Operations },
                        { label: operationId },
                    ]}
                />
                <Typography level="h1" className="text-2xl" semiBold>
                    Detalji radnje
                </Typography>
            </Stack>
            <Stack spacing={2}>
                <FieldSet>
                    <Field name="ID radnje" value={operation.id} />
                    <Field
                        name="Naziv"
                        value={
                            operationDetails?.information?.label ||
                            operation.entityId
                        }
                    />
                    <Field
                        name="Status"
                        value={
                            <Chip
                                className="w-fit"
                                color={
                                    operation.status === 'completed'
                                        ? 'success'
                                        : operation.status === 'planned'
                                          ? 'info'
                                          : operation.status === 'canceled'
                                            ? 'neutral'
                                            : 'warning'
                                }
                            >
                                {operation.status}
                            </Chip>
                        }
                    />
                    {operation.status === 'planned' &&
                        operation.scheduledDate && (
                            <Field
                                name="Zakazano"
                                value={
                                    <LocalDateTime time={false}>
                                        {operation.scheduledDate}
                                    </LocalDateTime>
                                }
                            />
                        )}
                    {operation.status === 'completed' && (
                        <>
                            {operation.completedBy && (
                                <Field
                                    name="Izvršio"
                                    value={operation.completedBy}
                                />
                            )}
                            {operation.completedAt && (
                                <Field
                                    name="Izvršeno"
                                    value={
                                        <LocalDateTime time={false}>
                                            {operation.completedAt}
                                        </LocalDateTime>
                                    }
                                />
                            )}
                        </>
                    )}
                    {operation.status === 'failed' && (
                        <>
                            {operation.error && (
                                <Field name="Greška" value={operation.error} />
                            )}
                            {operation.errorCode && (
                                <Field
                                    name="Kod greške"
                                    value={operation.errorCode}
                                />
                            )}
                        </>
                    )}
                    {operation.status === 'canceled' && (
                        <>
                            {operation.canceledBy && (
                                <Field
                                    name="Otkazao"
                                    value={operation.canceledBy}
                                />
                            )}
                            {operation.cancelReason && (
                                <Field
                                    name="Razlog otkazivanja"
                                    value={operation.cancelReason}
                                />
                            )}
                            {operation.canceledAt && (
                                <Field
                                    name="Otkazano"
                                    value={
                                        <LocalDateTime time={false}>
                                            {operation.canceledAt}
                                        </LocalDateTime>
                                    }
                                />
                            )}
                        </>
                    )}
                    {accountUsers && (
                        <Field name="Korisnici računa" value={accountUsers} />
                    )}
                    {gardenName && <Field name="Vrt" value={gardenName} />}
                    {raisedBed && (
                        <Field
                            name="Gredica"
                            value={`Gr ${raisedBed.physicalId}`}
                        />
                    )}
                    {raisedBedField && (
                        <Field
                            name="Polje gredice"
                            value={raisedBedField.positionIndex + 1}
                        />
                    )}
                    <Field
                        name="Datum"
                        value={
                            <LocalDateTime time={false}>
                                {operation.timestamp}
                            </LocalDateTime>
                        }
                    />
                    <Field
                        name="Datum stvaranja"
                        value={
                            <LocalDateTime time={false}>
                                {operation.createdAt}
                            </LocalDateTime>
                        }
                    />
                </FieldSet>
            </Stack>
            {operation.imageUrls && operation.imageUrls.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Slike</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Row className="flex-wrap" spacing={2}>
                            {operation.imageUrls.map((url) => (
                                <ImageViewer
                                    key={url}
                                    src={url}
                                    alt={`Slika radnje ${operation.id}`}
                                    previewWidth={200}
                                    previewHeight={150}
                                />
                            ))}
                        </Row>
                    </CardOverflow>
                </Card>
            )}
        </Stack>
    );
}
