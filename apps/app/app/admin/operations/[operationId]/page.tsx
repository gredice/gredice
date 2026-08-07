import {
    getAccount,
    getEntitiesFormatted,
    getFarm,
    getGarden,
    getOperationById,
    getRaisedBed,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { ExternalLink } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
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
import { OperationCancelButton } from '../../../../components/operations/OperationCancelButton';
import { OperationRescheduleButton } from '../../../../components/operations/OperationRescheduleButton';
import { OperationSwitchButton } from '../../../../components/operations/OperationSwitchButton';
import { OperationUnacceptButton } from '../../../../components/operations/OperationUnacceptButton';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { AcceptOperationModal } from '../../schedule/AcceptOperationModal';
import { OperationCompletionEvidenceEditModal } from '../../schedule/OperationCompletionEvidenceEditModal';
import { VerifyOperationModal } from '../../schedule/VerifyOperationModal';
import { operationDefinitionMatchesTargetScope } from '../operationScope';

export const dynamic = 'force-dynamic';

function operationStatusLabel(status: string) {
    switch (status) {
        case 'new':
            return 'Novo';
        case 'planned':
            return 'Planirano';
        case 'pendingVerification':
            return 'Čeka verifikaciju';
        case 'completed':
            return 'Završeno';
        case 'blocked':
            return 'Blokirano';
        case 'failed':
            return 'Neuspjelo';
        case 'canceled':
        case 'cancelled':
            return 'Otkazano';
        default:
            return status;
    }
}

function operationStatusColor(status: string) {
    switch (status) {
        case 'completed':
            return 'success';
        case 'pendingVerification':
            return 'warning';
        case 'planned':
            return 'info';
        case 'blocked':
            return 'error';
        case 'canceled':
        case 'cancelled':
            return 'neutral';
        case 'failed':
            return 'error';
        default:
            return 'warning';
    }
}

function operationStatusChip(status: string) {
    return (
        <Chip className="w-fit" color={operationStatusColor(status)}>
            {operationStatusLabel(status)}
        </Chip>
    );
}

function operationDateValue(value: Date | null | undefined) {
    if (!value) {
        return null;
    }

    return <LocalDateTime time={false}>{value}</LocalDateTime>;
}

function operationDurationMinutes(operationDetails?: EntityStandardized) {
    const duration = operationDetails?.attributes?.duration;

    if (typeof duration === 'number' && Number.isFinite(duration)) {
        return Math.max(0, duration);
    }

    if (typeof duration === 'string') {
        const parsed = Number.parseFloat(duration);
        if (Number.isFinite(parsed)) {
            return Math.max(0, parsed);
        }
    }

    return null;
}

function completionRequirements(operationDetails?: EntityStandardized) {
    const conditions = operationDetails?.conditions;
    const requirements: string[] = [];

    if (conditions?.completionAttachImagesRequired) {
        requirements.push('Slike obavezne');
    } else if (conditions?.completionAttachImages) {
        requirements.push('Slike opcionalne');
    }

    if (conditions?.completionAttachNotesRequired) {
        requirements.push('Napomena obavezna');
    } else if (conditions?.completionAttachNotes) {
        requirements.push('Napomena opcionalna');
    }

    return requirements.length > 0 ? requirements.join(', ') : null;
}

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
    const publishedOperationOptions =
        operationsData
            ?.filter((op) =>
                operationDefinitionMatchesTargetScope(operation, op),
            )
            .map((op) => ({
                id: op.id,
                label:
                    op.information?.label ??
                    op.information?.name ??
                    `Radnja ${op.id}`,
            })) ?? [];
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
    const durationMinutes = operationDurationMinutes(operationDetails);
    const requirements = completionRequirements(operationDetails);
    const publicOperationHref = operationDetails?.information?.label
        ? KnownPages.GrediceOperation(operationDetails.information.label)
        : KnownPages.GrediceOperations;
    const operationSwitchOptions = publishedOperationOptions.some(
        (option) => option.id === operation.entityId,
    )
        ? publishedOperationOptions
        : [
              {
                  id: operation.entityId,
                  label: operationTitle,
              },
              ...publishedOperationOptions,
          ];
    const assignedUsers =
        operation.assignedUsers && operation.assignedUsers.length > 0 ? (
            <Stack spacing={1}>
                {operation.assignedUsers.map((user) => {
                    const displayName = user.displayName ?? user.userName;

                    return (
                        <Row
                            key={user.id}
                            className="min-w-0 items-center"
                            spacing={2}
                        >
                            <UserAvatar
                                avatarUrl={user.avatarUrl}
                                displayName={displayName}
                                className="size-6 shrink-0"
                            />
                            <span className="min-w-0 truncate">
                                {displayName}
                            </span>
                        </Row>
                    );
                })}
            </Stack>
        ) : (
            'Nije dodijeljeno'
        );
    const acceptanceChip = operation.isAccepted ? (
        <Chip className="w-fit" color="success">
            Potvrđeno
        </Chip>
    ) : (
        <Chip className="w-fit" color="warning">
            Nije potvrđeno
        </Chip>
    );
    const operationAction = {
        id: operation.id,
        entityId: operation.entityId,
        taskVersionEventId: operation.taskVersionEventId,
        scheduledDate: operation.scheduledDate,
        status: operation.status,
    };
    const operationItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID radnje', value: operation.id, mono: true },
        {
            id: 'entity-id',
            label: 'ID zapisa',
            value: operation.entityId,
            mono: true,
        },
        {
            id: 'name',
            label: 'Naziv',
            value: operationDetails?.information?.label || operation.entityId,
        },
        {
            id: 'entity-type',
            label: 'Tip zapisa',
            value: operation.entityTypeName,
        },
        {
            id: 'status',
            label: 'Status',
            value: operationStatusChip(operation.status),
        },
        {
            id: 'public-link',
            label: 'Javni opis',
            value: (
                <a
                    className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline"
                    href={publicOperationHref}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <span className="min-w-0 truncate">Otvori</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                </a>
            ),
        },
    ];
    if (durationMinutes !== null) {
        operationItems.push({
            id: 'duration',
            label: 'Trajanje',
            value: `${durationMinutes} min`,
        });
    }
    if (typeof operationDetails?.prices?.perOperation === 'number') {
        operationItems.push({
            id: 'price',
            label: 'Cijena po radnji',
            value: operationDetails.prices.perOperation,
        });
    }
    if (requirements) {
        operationItems.push({
            id: 'completion-requirements',
            label: 'Za završetak',
            value: requirements,
        });
    }

    const locationItems: EntityDetailsPropertyListItem[] = [];
    if (operation.accountId) {
        locationItems.push({
            id: 'account',
            label: 'Račun',
            value: (
                <Link href={KnownPages.Account(operation.accountId)}>
                    {operation.accountId}
                </Link>
            ),
            mono: true,
        });
    }
    if (accountUsers && operation.accountId) {
        locationItems.push({
            id: 'account-users',
            label: 'Korisnici računa',
            value: (
                <Link href={KnownPages.Account(operation.accountId)}>
                    {accountUsers}
                </Link>
            ),
        });
    }
    if (farm) {
        locationItems.push({
            id: 'farm',
            label: 'Farma',
            value: <Link href={KnownPages.Farm(farm.id)}>{farm.name}</Link>,
        });
    }
    if (gardenName && garden) {
        locationItems.push({
            id: 'garden',
            label: 'Vrt',
            value: (
                <Link href={KnownPages.Garden(garden.id)}>{gardenName}</Link>
            ),
        });
    }
    if (raisedBed) {
        locationItems.push({
            id: 'raised-bed',
            label: 'Gredica',
            value: (
                <Link href={KnownPages.RaisedBed(raisedBed.id)}>
                    <RaisedBedLabel physicalId={raisedBed.physicalId} />
                </Link>
            ),
        });
    }
    if (raisedBedField) {
        locationItems.push({
            id: 'raised-bed-field',
            label: 'Polje gredice',
            value: raisedBedField.positionIndex + 1,
        });
    }
    if (locationItems.length === 0) {
        locationItems.push({
            id: 'location',
            label: 'Lokacija',
            value: 'Nije povezana',
        });
    }

    const assignmentItems: EntityDetailsPropertyListItem[] = [
        { id: 'accepted', label: 'Potvrda', value: acceptanceChip },
        { id: 'assigned-users', label: 'Dodijeljeno', value: assignedUsers },
    ];
    if (operation.assignedBy) {
        assignmentItems.push({
            id: 'assigned-by',
            label: 'Dodijelio',
            value: operation.assignedBy,
        });
    }
    if (operation.assignedAt) {
        assignmentItems.push({
            id: 'assigned-at',
            label: 'Dodijeljeno',
            value: operationDateValue(operation.assignedAt),
        });
    }
    assignmentItems.push(
        {
            id: 'scheduled-date',
            label: 'Zakazano za',
            value:
                operationDateValue(operation.scheduledDate) ?? 'Nije zakazano',
        },
        {
            id: 'scheduled-at',
            label: 'Zakazano',
            value: operationDateValue(operation.scheduledAt),
        },
        {
            id: 'timestamp',
            label: 'Datum radnje',
            value: operationDateValue(operation.timestamp),
        },
        {
            id: 'created-at',
            label: 'Datum stvaranja',
            value: operationDateValue(operation.createdAt),
        },
    );

    const outcomeItems: EntityDetailsPropertyListItem[] = [];
    if (operation.blockReasonLabel) {
        outcomeItems.push({
            id: 'block-reason',
            label: 'Razlog blokade',
            value: operation.blockReasonLabel,
        });
    }
    if (operation.blockReasonCode) {
        outcomeItems.push({
            id: 'block-reason-code',
            label: 'Kod razloga',
            value: operation.blockReasonCode,
            mono: true,
        });
    }
    if (operation.blockedBy) {
        outcomeItems.push({
            id: 'blocked-by',
            label: 'Prijavio',
            value: (
                <Link href={KnownPages.User(operation.blockedBy)}>
                    {operation.blockedBy}
                </Link>
            ),
            mono: true,
        });
    }
    if (operation.blockedAt) {
        outcomeItems.push({
            id: 'blocked-at',
            label: 'Prijavljeno',
            value: operationDateValue(operation.blockedAt),
        });
    }
    if (operation.blockNote) {
        outcomeItems.push({
            id: 'block-note',
            label: 'Napomena prepreke',
            value: (
                <span className="whitespace-pre-wrap">
                    {operation.blockNote}
                </span>
            ),
        });
    }
    if (operation.blockImageUrls && operation.blockImageUrls.length > 0) {
        outcomeItems.push({
            id: 'block-image-count',
            label: 'Fotografije prepreke',
            value: operation.blockImageUrls.length,
        });
    }
    if (operation.completedBy) {
        outcomeItems.push({
            id: 'completed-by',
            label:
                operation.status === 'pendingVerification'
                    ? 'Označio završeno'
                    : 'Izvršio',
            value: operation.completedBy,
        });
    }
    if (operation.completedAt) {
        outcomeItems.push({
            id: 'completed-at',
            label:
                operation.status === 'pendingVerification'
                    ? 'Označeno završeno'
                    : 'Izvršeno',
            value: operationDateValue(operation.completedAt),
        });
    }
    if (operation.verifiedBy) {
        outcomeItems.push({
            id: 'verified-by',
            label: 'Verificirao',
            value: operation.verifiedBy,
        });
    }
    if (operation.verifiedAt) {
        outcomeItems.push({
            id: 'verified-at',
            label: 'Verificirano',
            value: operationDateValue(operation.verifiedAt),
        });
    }
    if (operation.error) {
        outcomeItems.push({
            id: 'error',
            label: 'Greška',
            value: operation.error,
        });
    }
    if (operation.errorCode) {
        outcomeItems.push({
            id: 'error-code',
            label: 'Kod greške',
            value: operation.errorCode,
        });
    }
    if (operation.canceledBy) {
        outcomeItems.push({
            id: 'canceled-by',
            label: 'Otkazao',
            value: operation.canceledBy,
        });
    }
    if (operation.cancelReason) {
        outcomeItems.push({
            id: 'cancel-reason',
            label: 'Razlog otkazivanja',
            value: operation.cancelReason,
        });
    }
    if (operation.canceledAt) {
        outcomeItems.push({
            id: 'canceled-at',
            label: 'Otkazano',
            value: operationDateValue(operation.canceledAt),
        });
    }
    if (operation.completionNotes) {
        outcomeItems.push({
            id: 'completion-notes',
            label: 'Napomena',
            value: (
                <span className="whitespace-pre-wrap">
                    {operation.completionNotes}
                </span>
            ),
        });
    }
    if (operation.imageUrls && operation.imageUrls.length > 0) {
        outcomeItems.push({
            id: 'image-count',
            label: 'Slike',
            value: operation.imageUrls.length,
        });
    }
    if (outcomeItems.length === 0) {
        outcomeItems.push({
            id: 'outcome',
            label: 'Ishod',
            value: 'Još nema završnog zapisa',
        });
    }

    const description = operationDetails?.information?.description;
    const detailSections = [
        { id: 'operation', title: 'Radnja', items: operationItems },
        { id: 'location', title: 'Lokacija', items: locationItems },
        { id: 'assignment', title: 'Plan i dodjela', items: assignmentItems },
        { id: 'outcome', title: 'Ishod', items: outcomeItems },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            {detailSections.map((section) => (
                <EntityDetailsPanelCard key={section.id} title={section.title}>
                    <EntityDetailsPropertyList items={section.items} />
                </EntityDetailsPanelCard>
            ))}
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
                            {operation.status === 'pendingVerification' && (
                                <>
                                    <OperationCompletionEvidenceEditModal
                                        operationId={operation.id}
                                        expectedTaskVersionEventId={
                                            operation.taskVersionEventId
                                        }
                                        label={operationTitle}
                                        initialNotes={
                                            operation.completionNotes ?? ''
                                        }
                                        initialImageUrls={
                                            operation.imageUrls ?? []
                                        }
                                    />
                                    <VerifyOperationModal
                                        operationId={operation.id}
                                        expectedTaskVersionEventId={
                                            operation.taskVersionEventId
                                        }
                                        label={operationTitle}
                                    />
                                </>
                            )}
                            {operation.isAccepted ? (
                                <OperationUnacceptButton
                                    operationId={operation.id}
                                    expectedEntityId={operation.entityId}
                                    expectedTaskVersionEventId={
                                        operation.taskVersionEventId
                                    }
                                    operationStatus={operation.status}
                                    operationLabel={operationTitle}
                                />
                            ) : (
                                <AcceptOperationModal
                                    operationId={operation.id}
                                    expectedEntityId={operation.entityId}
                                    expectedTaskVersionEventId={
                                        operation.taskVersionEventId
                                    }
                                    operationStatus={operation.status}
                                    label={operationTitle}
                                    disabled={!operation.assignedUserId}
                                    raisedBedPhysicalId={
                                        raisedBed?.physicalId ?? undefined
                                    }
                                />
                            )}
                            <OperationSwitchButton
                                operationId={operation.id}
                                currentEntityId={operation.entityId}
                                taskVersionEventId={
                                    operation.taskVersionEventId
                                }
                                operationStatus={operation.status}
                                operationLabel={operationTitle}
                                operationOptions={operationSwitchOptions}
                            />
                            <OperationRescheduleButton
                                operation={operationAction}
                                operationLabel={operationTitle}
                            />
                            <OperationCancelButton
                                operation={operationAction}
                                operationLabel={operationTitle}
                            />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={operationTitle}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Stack spacing={4}>
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {detailSections.map((section) => (
                                <Card
                                    className="min-w-0 overflow-hidden"
                                    key={section.id}
                                >
                                    <CardHeader>
                                        <Row
                                            className="items-center justify-between gap-2"
                                            spacing={2}
                                        >
                                            <CardTitle className="text-lg">
                                                {section.title}
                                            </CardTitle>
                                            {section.id === 'operation' &&
                                                operationStatusChip(
                                                    operation.status,
                                                )}
                                        </Row>
                                    </CardHeader>
                                    <CardContent>
                                        <EntityDetailsPropertyList
                                            items={section.items}
                                        />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        {description && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Opis
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Typography className="whitespace-pre-wrap">
                                        {description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                        {operation.completionNotes && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Napomena završetka
                                    </CardTitle>
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
                                        <CardTitle className="text-lg">
                                            Slike
                                        </CardTitle>
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
                        {operation.blockImageUrls &&
                            operation.blockImageUrls.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">
                                            Fotografije prepreke
                                        </CardTitle>
                                    </CardHeader>
                                    <CardOverflow>
                                        <Row className="w-full" spacing={4}>
                                            <ImageGallery
                                                images={operation.blockImageUrls.map(
                                                    (url, index) => ({
                                                        src: url,
                                                        alt: `Fotografija prepreke ${index + 1} za radnju ${operation.id}`,
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
                        <Button
                            className="w-fit"
                            href={KnownPages.Operations}
                            variant="outlined"
                        >
                            Natrag na radnje
                        </Button>
                    </Stack>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
