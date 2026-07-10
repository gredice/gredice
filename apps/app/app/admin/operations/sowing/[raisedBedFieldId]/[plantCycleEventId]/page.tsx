import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { OperationImage } from '@gredice/ui/OperationImage';
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
} from '../../../../../../components/admin/details';
import { AdminPageHeader } from '../../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../../../components/admin/navigation/AdminPageTitle';
import { auth } from '../../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../../src/KnownPages';
import {
    operationListStatusColor,
    operationListStatusLabel,
} from '../../../operationListLabels';
import {
    findSowingTaskDetails,
    getOperationsListContext,
} from '../../../operationsListData';

export const dynamic = 'force-dynamic';

function parsePositiveInteger(value: string) {
    if (!/^\d+$/.test(value)) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return parsed > 0 ? parsed : null;
}

function dateValue(value: string | null) {
    return value ? <LocalDateTime time={false}>{value}</LocalDateTime> : null;
}

function sowingLocationLabel(location: 'direct' | 'greenhouse') {
    return location === 'greenhouse' ? 'Staklenik' : 'Direktno';
}

export default async function SowingTaskDetailsPage({
    params,
}: {
    params: Promise<{
        raisedBedFieldId: string;
        plantCycleEventId: string;
    }>;
}) {
    const resolvedParams = await params;
    const raisedBedFieldId = parsePositiveInteger(
        resolvedParams.raisedBedFieldId,
    );
    const plantCycleEventId = parsePositiveInteger(
        resolvedParams.plantCycleEventId,
    );
    if (!raisedBedFieldId || !plantCycleEventId) {
        notFound();
    }

    await auth(['admin']);
    const context = await getOperationsListContext();
    const task = findSowingTaskDetails({
        context,
        plantCycleEventId,
        raisedBedFieldId,
    });
    if (!task) {
        notFound();
    }

    const plantSort = context.plantSorts.find(
        (candidate) => candidate.id === task.plantSortId,
    );
    const assignedByUser = task.assignedBy
        ? context.users.find((user) => user.id === task.assignedBy)
        : undefined;
    const statusChip = (
        <Chip className="w-fit" color={operationListStatusColor(task.status)}>
            {operationListStatusLabel(task)}
        </Chip>
    );
    const sowingItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'plant-cycle-event-id',
            label: 'ID ciklusa',
            value: task.plantCycleEventId,
            mono: true,
        },
        {
            id: 'raised-bed-field-id',
            label: 'ID polja',
            value: task.raisedBedFieldId,
            mono: true,
        },
        { id: 'record-type', label: 'Vrsta zapisa', value: 'Sijanje' },
        {
            id: 'entity-type',
            label: 'Tip entiteta',
            value: task.entityTypeName,
            mono: true,
        },
        {
            id: 'plant-sort-id',
            label: 'ID sorte',
            value: task.plantSortId,
            mono: true,
        },
        {
            id: 'plant-sort',
            label: 'Sorta biljke',
            value: (
                <Link
                    href={KnownPages.DirectoryEntity(
                        'plantSort',
                        task.plantSortId,
                    )}
                >
                    {task.plantSortName}
                </Link>
            ),
        },
        {
            id: 'sowing-location',
            label: 'Lokacija sijanja',
            value: sowingLocationLabel(task.sowingLocation),
        },
        { id: 'status', label: 'Status', value: statusChip },
        {
            id: 'active-cycle',
            label: 'Aktivan ciklus',
            value: task.active,
        },
    ];

    const locationItems: EntityDetailsPropertyListItem[] = [];
    if (task.accountId) {
        locationItems.push({
            id: 'account',
            label: 'Račun',
            value: (
                <Link href={KnownPages.Account(task.accountId)}>
                    {task.accountId}
                </Link>
            ),
            mono: true,
        });
    }
    if (task.accountId && task.accountUserNames.length > 0) {
        locationItems.push({
            id: 'account-users',
            label: 'Korisnici računa',
            value: (
                <Link href={KnownPages.Account(task.accountId)}>
                    {task.accountUserNames.join(', ')}
                </Link>
            ),
        });
    }
    if (task.farmId && task.farmName) {
        locationItems.push({
            id: 'farm',
            label: 'Farma',
            value: (
                <Link href={KnownPages.Farm(task.farmId)}>{task.farmName}</Link>
            ),
        });
    }
    if (task.gardenId && task.gardenName) {
        locationItems.push({
            id: 'garden',
            label: 'Vrt',
            value: (
                <Link href={KnownPages.Garden(task.gardenId)}>
                    {task.gardenName}
                </Link>
            ),
        });
    }
    locationItems.push(
        {
            id: 'raised-bed',
            label: 'Gredica',
            value: (
                <Link href={KnownPages.RaisedBed(task.raisedBedId)}>
                    <RaisedBedLabel
                        name={task.raisedBedName}
                        physicalId={task.raisedBedPhysicalId}
                    />
                </Link>
            ),
        },
        {
            id: 'raised-bed-field',
            label: 'Polje gredice',
            value: task.raisedBedFieldPosition,
        },
    );

    const assignmentItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'assigned-users',
            label: 'Dodijeljeno',
            value:
                task.assignedUsers.length > 0 ? (
                    <Stack spacing={1}>
                        {task.assignedUsers.map((user) => (
                            <Link key={user.id} href={KnownPages.User(user.id)}>
                                {user.label}
                            </Link>
                        ))}
                    </Stack>
                ) : (
                    'Nije dodijeljeno'
                ),
        },
        {
            id: 'scheduled-date',
            label: 'Zakazano za',
            value: dateValue(task.scheduledDate) ?? 'Nije zakazano',
        },
        {
            id: 'created-at',
            label: 'Datum stvaranja',
            value: dateValue(task.createdAt),
        },
        {
            id: 'timestamp',
            label: 'Datum zapisa',
            value: dateValue(task.timestamp),
        },
    ];
    if (task.assignedBy) {
        assignmentItems.splice(1, 0, {
            id: 'assigned-by',
            label: 'Dodijelio',
            value: assignedByUser ? (
                <Link href={KnownPages.User(assignedByUser.id)}>
                    {assignedByUser.displayName ??
                        assignedByUser.userName ??
                        assignedByUser.id}
                </Link>
            ) : (
                task.assignedBy
            ),
        });
    }
    if (task.assignedAt) {
        assignmentItems.splice(task.assignedBy ? 2 : 1, 0, {
            id: 'assigned-at',
            label: 'Datum dodjele',
            value: dateValue(task.assignedAt),
        });
    }

    const outcomeItems: EntityDetailsPropertyListItem[] = [];
    if (task.completedAt) {
        outcomeItems.push({
            id: 'completed-at',
            label:
                task.status === 'pendingVerification'
                    ? 'Označeno posijano'
                    : 'Posijano',
            value: dateValue(task.completedAt),
        });
    }
    if (task.canceledAt) {
        outcomeItems.push({
            id: 'canceled-at',
            label: 'Otkazano',
            value: dateValue(task.canceledAt),
        });
    }
    if (task.cancellationReason) {
        outcomeItems.push({
            id: 'cancellation-reason',
            label: 'Razlog otkazivanja',
            value: task.cancellationReason,
        });
    }
    outcomeItems.push(
        {
            id: 'ended-at',
            label: 'Zadnja promjena',
            value: dateValue(task.endedAt),
        },
        {
            id: 'ended-event-id',
            label: 'ID zadnjeg događaja',
            value: task.endedEventId,
            mono: true,
        },
        {
            id: 'event-count',
            label: 'Broj događaja',
            value: task.eventIds.length,
        },
        {
            id: 'event-ids',
            label: 'ID-evi događaja',
            value: task.eventIds.join(', '),
            mono: true,
        },
    );

    const detailSections = [
        { id: 'sowing', title: 'Sijanje', items: sowingItems },
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
                <AdminPageTitle title={task.label} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Operations,
                                },
                                {
                                    label: 'Sijanje',
                                    href: `${KnownPages.Operations}?type=sowing`,
                                },
                                { label: task.plantCycleEventId },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={task.label}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Stack spacing={4}>
                        <Card>
                            <CardContent className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center">
                                <div className="flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                                    <OperationImage
                                        operation={task.operationDefinition}
                                        size={160}
                                        className="size-40"
                                    />
                                </div>
                                <Stack spacing={2}>
                                    <Typography level="h2">
                                        {task.label}
                                    </Typography>
                                    <Link
                                        className="w-fit text-primary hover:underline"
                                        href={KnownPages.DirectoryEntity(
                                            'plantSort',
                                            task.plantSortId,
                                        )}
                                    >
                                        Otvori sortu biljke
                                    </Link>
                                </Stack>
                            </CardContent>
                        </Card>
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
                                            {section.id === 'sowing'
                                                ? statusChip
                                                : null}
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
                        {plantSort?.information?.description ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Opis sorte
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Typography className="whitespace-pre-wrap">
                                        {plantSort.information.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ) : null}
                    </Stack>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
