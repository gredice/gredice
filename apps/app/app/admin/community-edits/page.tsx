import {
    type CommunityEditRequestStatus,
    listCommunityEditRequests,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
    'all',
    'pending',
    'conflicted',
    'approved',
    'applied',
    'rejected',
    'canceled',
] as const;

const ENTITY_TYPE_OPTIONS = ['all', 'plant', 'plantSort', 'operation', 'block'];

const AGE_OPTIONS = ['all', 'day', 'week', 'older'] as const;

type StatusOption = (typeof STATUS_OPTIONS)[number];
type AgeOption = (typeof AGE_OPTIONS)[number];
type CommunityEditRequestListItem = Awaited<
    ReturnType<typeof listCommunityEditRequests>
>[number];

function statusLabel(status: CommunityEditRequestStatus | StatusOption) {
    switch (status) {
        case 'all':
            return 'Svi';
        case 'pending':
            return 'Na čekanju';
        case 'approved':
            return 'Odobreno';
        case 'applied':
            return 'Primijenjeno';
        case 'rejected':
            return 'Odbijeno';
        case 'conflicted':
            return 'Konflikt';
        case 'canceled':
            return 'Otkazano';
    }
}

function statusColor(status: CommunityEditRequestStatus): ColorPaletteProp {
    switch (status) {
        case 'pending':
            return 'warning';
        case 'approved':
            return 'info';
        case 'applied':
            return 'success';
        case 'rejected':
        case 'canceled':
            return 'neutral';
        case 'conflicted':
            return 'error';
    }
}

function entityTypeLabel(entityTypeName: string) {
    switch (entityTypeName) {
        case 'plant':
            return 'Biljka';
        case 'plantSort':
            return 'Sorta';
        case 'operation':
            return 'Radnja';
        case 'block':
            return 'Blok';
        default:
            return entityTypeName;
    }
}

function isStatusOption(value: string | undefined): value is StatusOption {
    return STATUS_OPTIONS.includes(value as StatusOption);
}

function isAgeOption(value: string | undefined): value is AgeOption {
    return AGE_OPTIONS.includes(value as AgeOption);
}

function buildFilterHref(params: {
    status?: StatusOption;
    entityType?: string;
    submitter?: string;
    age?: AgeOption;
}) {
    const search = new URLSearchParams();
    if (params.status && params.status !== 'all') {
        search.set('status', params.status);
    }
    if (params.entityType && params.entityType !== 'all') {
        search.set('entityType', params.entityType);
    }
    if (params.submitter) {
        search.set('submitter', params.submitter);
    }
    if (params.age && params.age !== 'all') {
        search.set('age', params.age);
    }

    const query = search.toString();
    return query
        ? `${KnownPages.CommunityEdits}?${query}`
        : KnownPages.CommunityEdits;
}

function requestMatchesAge(
    request: Pick<CommunityEditRequestListItem, 'createdAt'>,
    age: AgeOption,
) {
    if (age === 'all') {
        return true;
    }

    const now = Date.now();
    const createdAt = request.createdAt.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const ageMs = now - createdAt;
    if (age === 'day') {
        return ageMs <= oneDay;
    }
    if (age === 'week') {
        return ageMs > oneDay && ageMs <= 7 * oneDay;
    }

    return ageMs > 7 * oneDay;
}

function requestMatchesSubmitter(
    request: Pick<
        CommunityEditRequestListItem,
        'submitterName' | 'submitterEmail' | 'submitterUserId'
    >,
    submitter: string,
) {
    if (!submitter) {
        return true;
    }

    const query = submitter.toLowerCase();
    return [
        request.submitterName,
        request.submitterEmail,
        request.submitterUserId,
    ].some((value) => value?.toLowerCase().includes(query));
}

function ageLabel(age: AgeOption) {
    switch (age) {
        case 'all':
            return 'Sva dob';
        case 'day':
            return 'Zadnja 24 h';
        case 'week':
            return '2-7 dana';
        case 'older':
            return 'Starije';
    }
}

export default async function CommunityEditsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const params = await searchParams;
    const rawStatus =
        typeof params.status === 'string' ? params.status : undefined;
    const selectedStatus = isStatusOption(rawStatus) ? rawStatus : 'all';
    const rawEntityType =
        typeof params.entityType === 'string' ? params.entityType : undefined;
    const selectedEntityType = rawEntityType ?? 'all';
    const submitter =
        typeof params.submitter === 'string' ? params.submitter.trim() : '';
    const rawAge = typeof params.age === 'string' ? params.age : undefined;
    const selectedAge = isAgeOption(rawAge) ? rawAge : 'all';

    const allRequests = await listCommunityEditRequests();
    const filteredRequests = allRequests.filter(
        (request) =>
            (selectedStatus === 'all' || request.status === selectedStatus) &&
            (selectedEntityType === 'all' ||
                request.entityTypeName === selectedEntityType) &&
            requestMatchesAge(request, selectedAge) &&
            requestMatchesSubmitter(request, submitter),
    );
    const statusCounts = new Map<CommunityEditRequestStatus, number>();
    for (const request of allRequests) {
        statusCounts.set(
            request.status as CommunityEditRequestStatus,
            (statusCounts.get(request.status as CommunityEditRequestStatus) ??
                0) + 1,
        );
    }

    return (
        <Stack spacing={4}>
            <Row spacing={2} className="flex-wrap gap-2">
                <Chip color="primary">{filteredRequests.length}</Chip>
                <Typography level="body2" className="text-muted-foreground">
                    Prijedlozi za javni sadržaj direktorija
                </Typography>
            </Row>

            <Row spacing={2} className="flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => {
                    const isActive = selectedStatus === status;
                    const count =
                        status === 'all'
                            ? allRequests.length
                            : (statusCounts.get(status) ?? 0);
                    return (
                        <Chip
                            key={status}
                            color={isActive ? 'primary' : 'neutral'}
                            href={buildFilterHref({
                                status,
                                entityType: selectedEntityType,
                                submitter,
                                age: selectedAge,
                            })}
                        >
                            {statusLabel(status)} ({count})
                        </Chip>
                    );
                })}
            </Row>

            <form action={KnownPages.CommunityEdits}>
                <Row spacing={2} className="flex-wrap items-end gap-2">
                    <label className="space-y-1">
                        <Typography level="body2">Tip zapisa</Typography>
                        <select
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            defaultValue={selectedEntityType}
                            name="entityType"
                        >
                            {ENTITY_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option === 'all'
                                        ? 'Svi zapisi'
                                        : entityTypeLabel(option)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <Typography level="body2">Dob</Typography>
                        <select
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            defaultValue={selectedAge}
                            name="age"
                        >
                            {AGE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {ageLabel(option)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Input
                        defaultValue={submitter}
                        fullWidth
                        label="Pošiljatelj"
                        name="submitter"
                        placeholder="Ime, email ili ID"
                    />
                    {selectedStatus !== 'all' ? (
                        <input
                            name="status"
                            type="hidden"
                            value={selectedStatus}
                        />
                    ) : null}
                    <Button type="submit" variant="outlined">
                        Filtriraj
                    </Button>
                    <Button href={KnownPages.CommunityEdits} variant="plain">
                        Resetiraj
                    </Button>
                </Row>
            </form>

            <Card>
                <CardOverflow>
                    <div className="overflow-auto">
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Zahtjev</Table.Head>
                                    <Table.Head>Promjene</Table.Head>
                                    <Table.Head>Pošiljatelj</Table.Head>
                                    <Table.Head>Kreirano</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {filteredRequests.length === 0 && (
                                    <Table.Row>
                                        <Table.Cell colSpan={5}>
                                            <NoDataPlaceholder>
                                                Nema prijedloga za odabrane
                                                filtre.
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                                {filteredRequests.map((request) => (
                                    <Table.Row key={request.id}>
                                        <Table.Cell>
                                            <Chip
                                                color={statusColor(
                                                    request.status as CommunityEditRequestStatus,
                                                )}
                                                size="sm"
                                                variant="soft"
                                            >
                                                {statusLabel(
                                                    request.status as CommunityEditRequestStatus,
                                                )}
                                            </Chip>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                <Link
                                                    href={KnownPages.CommunityEdit(
                                                        request.id,
                                                    )}
                                                >
                                                    {entityTypeLabel(
                                                        request.entityTypeName,
                                                    )}{' '}
                                                    #{request.entityId}
                                                </Link>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    {request.sectionKey ??
                                                        'Cijela stranica'}
                                                </Typography>
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {request.changes.length}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                <Typography level="body2">
                                                    {request.submitterName ??
                                                        request.submitterUserId}
                                                </Typography>
                                                {request.submitterEmail ? (
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        {request.submitterEmail}
                                                    </Typography>
                                                ) : null}
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {request.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
