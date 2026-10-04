import {
    getAccount,
    getAssignableFarmUsersByOperationIds,
    getEntitiesFormatted,
    getFarm,
    getGarden,
    getOperationById,
    getOperationPrices,
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
import { Euro, ExternalLink, Graph, Timer, Wallet } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { OperationImage } from '@gredice/ui/OperationImage';
import { OperationRequestNote } from '@gredice/ui/OperationRequestNote';
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
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { VerifyOperationModal } from '../../schedule/VerifyOperationModal';
import { OperationDescriptionCard } from '../OperationDescriptionCard';
import { OperationTaskAdminEditModal } from '../OperationTaskAdminEditModal';
import {
    operationDefinitionPricing,
    operationMoneyDisplay,
} from '../operationDefinitionPricing';
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

    const [
        operationsData,
        account,
        farm,
        garden,
        raisedBed,
        assignableUsersByOperationId,
    ] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('operation'),
        operation.accountId
            ? getAccount(operation.accountId)
            : Promise.resolve(undefined),
        operation.farmId ? getFarm(operation.farmId) : Promise.resolve(null),
        operation.gardenId
            ? getGarden(operation.gardenId)
            : Promise.resolve(undefined),
        operation.raisedBedId
            ? getRaisedBed(operation.raisedBedId)
            : Promise.resolve(undefined),
        getAssignableFarmUsersByOperationIds([operation.id]),
    ]);

    const effectiveFarmId = operation.farmId ?? garden?.farmId;
    const farmerPrices = effectiveFarmId
        ? await getOperationPrices(effectiveFarmId)
        : [];
    const assignableUsers = [
        ...(assignableUsersByOperationId[operation.id] ?? []),
    ];
    for (const user of operation.assignedUsers ?? []) {
        if (!assignableUsers.some((option) => option.id === user.id))
            assignableUsers.push({ ...user, farmId: effectiveFarmId ?? 0 });
    }
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
                                achievementCount={user.achievementCount}
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
    const pricing = operationDefinitionPricing(
        operation.entityId,
        operationDetails?.prices?.perOperation,
        farmerPrices,
    );
    const operationItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'entity-id',
            label: 'ID zapisa',
            value: (
                <Link
                    href={KnownPages.DirectoryEntity(
                        'operation',
                        operation.entityId,
                    )}
                >
                    {operation.entityId}
                </Link>
            ),
            mono: true,
        },
        {
            id: 'duration',
            label: 'Trajanje',
            value:
                durationMinutes !== null
                    ? `${durationMinutes} min`
                    : 'Nije određeno',
            visual: <Timer className="size-4" />,
        },
        {
            id: 'user-price',
            label: 'Cijena korisnika',
            value: operationMoneyDisplay(pricing.customerAmount),
            visual: <Euro className="size-4" />,
        },
        {
            id: 'farmer-price',
            label: 'Cijena farmera',
            value: operationMoneyDisplay(
                pricing.farmerAmount,
                pricing.farmerCurrency,
            ),
            visual: <Wallet className="size-4" />,
        },
        {
            id: 'profit',
            label: 'Dobit po radnji',
            value: operationMoneyDisplay(pricing.profit),
            visual: <Graph className="size-4" />,
        },
        {
            id: 'public-link',
            label: 'Javni opis',
            value: (
                <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={publicOperationHref}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Otvori
                    <ExternalLink className="size-3.5" />
                </a>
            ),
        },
    ];
    if (requirements)
        operationItems.push({
            id: 'completion-requirements',
            label: 'Za završetak',
            value: requirements,
        });
    const taskItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID zadatka', value: operation.id, mono: true },
        {
            id: 'status',
            label: 'Status',
            value: operationStatusChip(operation.status),
        },
    ];
    const isoDate = (value: Date | null | undefined) =>
        value?.toISOString() ?? null;
    const taskAdminValues = {
        entityId: operation.entityId,
        status: operation.status,
        isAccepted: operation.isAccepted,
        assignedUserIds: operation.assignedUserIds,
        timestamp: operation.timestamp.toISOString(),
        createdAt: operation.createdAt.toISOString(),
        assignedAt: isoDate(operation.assignedAt),
        scheduledDate: isoDate(operation.scheduledDate),
        scheduledAt: isoDate(operation.scheduledAt),
        completedAt: isoDate(operation.completedAt),
        verifiedAt: isoDate(operation.verifiedAt),
        blockedAt: isoDate(operation.blockedAt),
        canceledAt: isoDate(operation.canceledAt),
        requestNote: operation.requestNote ?? '',
        blockReasonCode: operation.blockReasonCode ?? '',
        blockReasonLabel: operation.blockReasonLabel ?? '',
        blockNote: operation.blockNote ?? '',
        error: operation.error ?? '',
        errorCode: operation.errorCode ?? '',
        cancelReason: operation.cancelReason ?? '',
    };

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
    const selectedPlanting = raisedBed?.plantings.find(
        (planting) => planting.id === operation.plantingId,
    );
    if (selectedPlanting) {
        locationItems.push({
            id: 'planting-fields',
            label: 'Polja sadnje',
            value: selectedPlanting.memberships
                .filter(
                    (membership) =>
                        !membership.isDeleted &&
                        !membership.raisedBedField.isDeleted,
                )
                .map(
                    (membership) => membership.raisedBedField.positionIndex + 1,
                )
                .sort((a, b) => a - b)
                .join(', '),
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
    if (operation.requestNote) {
        outcomeItems.push({
            id: 'request-note',
            label: 'Napomena korisnika',
            value: (
                <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {operation.requestNote}
                </span>
            ),
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
    const shortDescription =
        operationDetails?.information?.shortDescription ||
        description?.split('\n')[0];
    const detailSections = [
        { id: 'operation', title: 'Radnja', items: operationItems },
        { id: 'location', title: 'Lokacija', items: locationItems },
        {
            id: 'task',
            title: 'Zadatak radnje',
            items: [...taskItems, ...assignmentItems, ...outcomeItems],
        },
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
                                <VerifyOperationModal
                                    operationId={operation.id}
                                    expectedTaskVersionEventId={
                                        operation.taskVersionEventId
                                    }
                                    label={operationTitle}
                                />
                            )}
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
                                    className={`min-w-0 overflow-hidden ${section.id === 'task' ? 'xl:col-span-2' : ''}`}
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
                                            {section.id === 'task' && (
                                                <Row
                                                    spacing={2}
                                                    className="items-center"
                                                >
                                                    {operationStatusChip(
                                                        operation.status,
                                                    )}
                                                    <OperationTaskAdminEditModal
                                                        operationId={
                                                            operation.id
                                                        }
                                                        taskVersionEventId={
                                                            operation.taskVersionEventId
                                                        }
                                                        initialValues={
                                                            taskAdminValues
                                                        }
                                                        operationOptions={
                                                            operationSwitchOptions
                                                        }
                                                        assignableUsers={
                                                            assignableUsers
                                                        }
                                                    />
                                                </Row>
                                            )}
                                        </Row>
                                    </CardHeader>
                                    <CardContent>
                                        {section.id === 'operation' && (
                                            <Row
                                                spacing={4}
                                                className="mb-4 items-center"
                                            >
                                                <OperationImage
                                                    size={96}
                                                    operation={{
                                                        ...operationDetails,
                                                        image:
                                                            operationDetails?.image ??
                                                            operationDetails?.images,
                                                    }}
                                                    className="rounded-md bg-muted/40"
                                                />
                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography level="h5">
                                                        {operationTitle}
                                                    </Typography>
                                                    {shortDescription && (
                                                        <Typography
                                                            level="body2"
                                                            className="text-muted-foreground"
                                                        >
                                                            {shortDescription}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Row>
                                        )}
                                        {section.id === 'task' ? (
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <div>
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                        className="mb-2"
                                                    >
                                                        Plan i dodjela
                                                    </Typography>
                                                    <EntityDetailsPropertyList
                                                        items={[
                                                            ...taskItems,
                                                            ...assignmentItems,
                                                        ]}
                                                    />
                                                </div>
                                                <div>
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                        className="mb-2"
                                                    >
                                                        Ishod
                                                    </Typography>
                                                    <EntityDetailsPropertyList
                                                        items={outcomeItems}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <EntityDetailsPropertyList
                                                items={section.items}
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <OperationDescriptionCard
                            description={description}
                            operationId={operation.id}
                            taskVersionEventId={operation.taskVersionEventId}
                            label={operationTitle}
                            completionNotes={operation.completionNotes}
                            completionNotesEdited={
                                operation.completionNotesEdited
                            }
                            imageUrls={operation.imageUrls}
                        />
                        {operation.requestNote && (
                            <OperationRequestNote
                                note={operation.requestNote}
                            />
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
