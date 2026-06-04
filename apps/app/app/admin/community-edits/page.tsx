import {
    type CommunityEditRequestStatus,
    listCommunityEditRequests,
} from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import {
    type CommunityEditSubmitterFilterOption,
    CommunityEditsFilters,
} from './CommunityEditsFilters';
import {
    type AgeOption,
    entityTypeLabel,
    isAgeOption,
    isStatusOption,
    statusLabel,
} from './communityEditLabels';

export const dynamic = 'force-dynamic';

type CommunityEditRequestListItem = Awaited<
    ReturnType<typeof listCommunityEditRequests>
>[number];

const REQUEST_STATUS_VALUES: readonly string[] = [
    'applied',
    'approved',
    'canceled',
    'conflicted',
    'pending',
    'rejected',
];

function isCommunityEditRequestStatus(
    status: string,
): status is CommunityEditRequestStatus {
    return REQUEST_STATUS_VALUES.includes(status);
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

function submitterDisplayName(request: CommunityEditRequestListItem) {
    return (
        request.submitter?.displayName ??
        request.submitterName ??
        request.submitter?.userName ??
        request.submitterUserId
    );
}

function submitterFilterLabel(request: CommunityEditRequestListItem) {
    const displayName = submitterDisplayName(request);
    return request.submitterEmail
        ? `${displayName} (${request.submitterEmail})`
        : displayName;
}

function buildSubmitterFilterOptions(
    requests: CommunityEditRequestListItem[],
): CommunityEditSubmitterFilterOption[] {
    const submittersById = new Map<string, string>();
    for (const request of requests) {
        if (!submittersById.has(request.submitterUserId)) {
            submittersById.set(
                request.submitterUserId,
                submitterFilterLabel(request),
            );
        }
    }

    return Array.from(submittersById, ([value, label]) => ({
        value,
        label,
    })).sort((left, right) => left.label.localeCompare(right.label, 'hr'));
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
    const submitterFilterOptions = buildSubmitterFilterOptions(allRequests);

    return (
        <Stack spacing={4}>
            <Typography level="body2" className="text-muted-foreground">
                Prijedlozi za javni sadržaj direktorija
            </Typography>

            <CommunityEditsFilters submitters={submitterFilterOptions} />

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
                                {filteredRequests.map((request) => {
                                    const requestStatus =
                                        isCommunityEditRequestStatus(
                                            request.status,
                                        )
                                            ? request.status
                                            : null;
                                    const displayName =
                                        submitterDisplayName(request);

                                    return (
                                        <Table.Row key={request.id}>
                                            <Table.Cell>
                                                <Chip
                                                    color={
                                                        requestStatus
                                                            ? statusColor(
                                                                  requestStatus,
                                                              )
                                                            : 'neutral'
                                                    }
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    {statusLabel(
                                                        request.status,
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
                                                <Chip
                                                    color="info"
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    {request.changes.length}
                                                </Chip>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Link
                                                    href={KnownPages.User(
                                                        request.submitterUserId,
                                                    )}
                                                    className="flex min-w-0 items-center gap-2"
                                                >
                                                    <UserAvatar
                                                        avatarUrl={
                                                            request.submitter
                                                                ?.avatarUrl
                                                        }
                                                        displayName={
                                                            displayName
                                                        }
                                                        size="sm"
                                                    />
                                                    <Stack
                                                        spacing={0}
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            level="body2"
                                                            className="truncate"
                                                        >
                                                            {displayName}
                                                        </Typography>
                                                        {request.submitterEmail ? (
                                                            <Typography
                                                                level="body3"
                                                                className="truncate text-muted-foreground"
                                                            >
                                                                {
                                                                    request.submitterEmail
                                                                }
                                                            </Typography>
                                                        ) : null}
                                                    </Stack>
                                                </Link>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime>
                                                    {request.createdAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
