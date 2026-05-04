import {
    getAccount,
    getEntitiesFormatted,
    getGarden,
    getOperationById,
    getRaisedBed,
} from '@gredice/storage';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
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
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
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

    if (!operation.accountId) {
        return notFound();
    }

    const [operationsData, account, garden, raisedBed] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation'),
        getAccount(operation.accountId),
        operation.gardenId
            ? getGarden(operation.gardenId)
            : Promise.resolve(undefined),
        operation.raisedBedId
            ? getRaisedBed(operation.raisedBedId)
            : Promise.resolve(undefined),
    ]);

    const operationDetails = operationsData?.find(
        (op) => op.id === operation.entityId,
    );
    const accountUsers = account?.accountUsers
        .map((au) => au.user.displayName ?? au.user.userName)
        .join(', ');
    const gardenName = garden?.name;
    const raisedBedField =
        raisedBed && operation.raisedBedFieldId
            ? raisedBed.fields.find((f) => f.id === operation.raisedBedFieldId)
            : undefined;

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.Operations,
                            },
                            { label: operationId },
                        ]}
                    />
                }
                heading="Detalji radnje"
            />
            <Stack spacing={2}>
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
                                        : operation.status ===
                                            'pendingVerification'
                                          ? 'warning'
                                          : operation.status === 'planned'
                                            ? 'info'
                                            : operation.status === 'canceled'
                                              ? 'neutral'
                                              : 'warning'
                                }
                            >
                                {operation.status === 'pendingVerification'
                                    ? 'Čeka verifikaciju'
                                    : operation.status}
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
                            {operation.verifiedBy && (
                                <Field
                                    name="Verificirao"
                                    value={operation.verifiedBy}
                                />
                            )}
                            {operation.verifiedAt && (
                                <Field
                                    name="Verificirano"
                                    value={
                                        <LocalDateTime time={false}>
                                            {operation.verifiedAt}
                                        </LocalDateTime>
                                    }
                                />
                            )}
                        </>
                    )}
                    {operation.status === 'pendingVerification' && (
                        <>
                            {operation.completedBy && (
                                <Field
                                    name="Označio završeno"
                                    value={operation.completedBy}
                                />
                            )}
                            {operation.completedAt && (
                                <Field
                                    name="Označeno završeno"
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
                        <Link href={KnownPages.Account(operation.accountId)}>
                            <Field
                                name="Korisnici računa"
                                value={accountUsers}
                            />
                        </Link>
                    )}
                    {gardenName && (
                        <Link href={KnownPages.Garden(garden.id)}>
                            <Field name="Vrt" value={gardenName} />
                        </Link>
                    )}
                    {raisedBed && (
                        <Link href={KnownPages.RaisedBed(raisedBed.id)}>
                            <Field
                                name="Gredica"
                                value={
                                    <RaisedBedLabel
                                        physicalId={raisedBed.physicalId}
                                    />
                                }
                            />
                        </Link>
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
                        <Row className="w-full" spacing={2}>
                            <ImageGallery
                                images={operation.imageUrls.map((url) => ({
                                    src: url,
                                    alt: `Slika radnje ${operation.id}`,
                                }))}
                                previewWidth={200}
                                previewHeight={150}
                                previewVariant="carousel"
                            />
                        </Row>
                    </CardOverflow>
                </Card>
            )}
        </Stack>
    );
}
