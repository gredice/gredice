import {
    getAccount,
    getEntitiesFormatted,
    getFarm,
    getGarden,
    getOperationById,
    getRaisedBed,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../components/admin/details';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
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

    if (!operation.accountId && !operation.farmId) {
        return notFound();
    }

    const [operationsData, account, farm, garden, raisedBed] =
        await Promise.all([
            getEntitiesFormatted<EntityStandardized>('operation'),
            operation.accountId
                ? getAccount(operation.accountId)
                : Promise.resolve(undefined),
            operation.farmId
                ? getFarm(operation.farmId)
                : Promise.resolve(null),
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
    const operationTitle =
        operationDetails?.information?.label ||
        operationDetails?.information?.name ||
        `Radnja ${operation.id}`;
    const operationStatusChip = (
        <Chip
            className="w-fit"
            color={
                operation.status === 'completed'
                    ? 'success'
                    : operation.status === 'pendingVerification'
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
    );
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID radnje', value: operation.id },
        {
            id: 'name',
            label: 'Naziv',
            value: operationDetails?.information?.label || operation.entityId,
        },
        { id: 'status', label: 'Status', value: operationStatusChip },
        ...(operation.status === 'planned' && operation.scheduledDate
            ? [
                  {
                      id: 'scheduled-at',
                      label: 'Zakazano',
                      value: (
                          <LocalDateTime time={false}>
                              {operation.scheduledDate}
                          </LocalDateTime>
                      ),
                  },
              ]
            : []),
        ...(operation.status === 'completed'
            ? [
                  ...(operation.completedBy
                      ? [
                            {
                                id: 'completed-by',
                                label: 'Izvršio',
                                value: operation.completedBy,
                            },
                        ]
                      : []),
                  ...(operation.completedAt
                      ? [
                            {
                                id: 'completed-at',
                                label: 'Izvršeno',
                                value: (
                                    <LocalDateTime time={false}>
                                        {operation.completedAt}
                                    </LocalDateTime>
                                ),
                            },
                        ]
                      : []),
                  ...(operation.verifiedBy
                      ? [
                            {
                                id: 'verified-by',
                                label: 'Verificirao',
                                value: operation.verifiedBy,
                            },
                        ]
                      : []),
                  ...(operation.verifiedAt
                      ? [
                            {
                                id: 'verified-at',
                                label: 'Verificirano',
                                value: (
                                    <LocalDateTime time={false}>
                                        {operation.verifiedAt}
                                    </LocalDateTime>
                                ),
                            },
                        ]
                      : []),
              ]
            : []),
        ...(operation.status === 'pendingVerification'
            ? [
                  ...(operation.completedBy
                      ? [
                            {
                                id: 'marked-completed-by',
                                label: 'Označio završeno',
                                value: operation.completedBy,
                            },
                        ]
                      : []),
                  ...(operation.completedAt
                      ? [
                            {
                                id: 'marked-completed-at',
                                label: 'Označeno završeno',
                                value: (
                                    <LocalDateTime time={false}>
                                        {operation.completedAt}
                                    </LocalDateTime>
                                ),
                            },
                        ]
                      : []),
              ]
            : []),
        ...(operation.status === 'failed'
            ? [
                  ...(operation.error
                      ? [
                            {
                                id: 'error',
                                label: 'Greška',
                                value: operation.error,
                            },
                        ]
                      : []),
                  ...(operation.errorCode
                      ? [
                            {
                                id: 'error-code',
                                label: 'Kod greške',
                                value: operation.errorCode,
                            },
                        ]
                      : []),
              ]
            : []),
        ...(operation.status === 'canceled'
            ? [
                  ...(operation.canceledBy
                      ? [
                            {
                                id: 'canceled-by',
                                label: 'Otkazao',
                                value: operation.canceledBy,
                            },
                        ]
                      : []),
                  ...(operation.cancelReason
                      ? [
                            {
                                id: 'cancel-reason',
                                label: 'Razlog otkazivanja',
                                value: operation.cancelReason,
                            },
                        ]
                      : []),
                  ...(operation.canceledAt
                      ? [
                            {
                                id: 'canceled-at',
                                label: 'Otkazano',
                                value: (
                                    <LocalDateTime time={false}>
                                        {operation.canceledAt}
                                    </LocalDateTime>
                                ),
                            },
                        ]
                      : []),
              ]
            : []),
        ...(accountUsers && operation.accountId
            ? [
                  {
                      id: 'account-users',
                      label: 'Korisnici računa',
                      value: (
                          <Link href={KnownPages.Account(operation.accountId)}>
                              {accountUsers}
                          </Link>
                      ),
                  },
              ]
            : []),
        ...(farm
            ? [
                  {
                      id: 'farm',
                      label: 'Farma',
                      value: (
                          <Link href={KnownPages.Farm(farm.id)}>
                              {farm.name}
                          </Link>
                      ),
                  },
              ]
            : []),
        ...(gardenName && garden
            ? [
                  {
                      id: 'garden',
                      label: 'Vrt',
                      value: (
                          <Link href={KnownPages.Garden(garden.id)}>
                              {gardenName}
                          </Link>
                      ),
                  },
              ]
            : []),
        ...(raisedBed
            ? [
                  {
                      id: 'raised-bed',
                      label: 'Gredica',
                      value: (
                          <Link href={KnownPages.RaisedBed(raisedBed.id)}>
                              <RaisedBedLabel
                                  physicalId={raisedBed.physicalId}
                              />
                          </Link>
                      ),
                  },
              ]
            : []),
        ...(raisedBedField
            ? [
                  {
                      id: 'raised-bed-field',
                      label: 'Polje gredice',
                      value: raisedBedField.positionIndex + 1,
                  },
              ]
            : []),
        {
            id: 'timestamp',
            label: 'Datum',
            value: (
                <LocalDateTime time={false}>
                    {operation.timestamp}
                </LocalDateTime>
            ),
        },
        {
            id: 'created-at',
            label: 'Datum stvaranja',
            value: (
                <LocalDateTime time={false}>
                    {operation.createdAt}
                </LocalDateTime>
            ),
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={operationTitle} />
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
                    actions={
                        <Row className="items-center" spacing={2}>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading="Detalji radnje"
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Stack spacing={8}>
                        {operation.completionNotes && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Napomena završetka</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Typography className="whitespace-pre-wrap">
                                        {operation.completionNotes}
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                        {operation.imageUrls &&
                            operation.imageUrls.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Slike</CardTitle>
                                    </CardHeader>
                                    <CardOverflow>
                                        <Row className="w-full" spacing={4}>
                                            <ImageGallery
                                                images={operation.imageUrls.map(
                                                    (url) => ({
                                                        src: url,
                                                        alt: `Slika radnje ${operation.id}`,
                                                    }),
                                                )}
                                                previewWidth={200}
                                                previewHeight={150}
                                                previewVariant="carousel"
                                            />
                                        </Row>
                                    </CardOverflow>
                                </Card>
                            )}
                    </Stack>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
