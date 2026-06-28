import {
    type CommunityEditRequestStatus,
    listCommunityEditRequests,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { ExternalLink } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
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
    exactSubmitterIds: ReadonlySet<string>,
) {
    if (!submitter) {
        return true;
    }

    if (exactSubmitterIds.has(submitter)) {
        return request.submitterUserId === submitter;
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

function publicPageUrl(publicPath: string) {
    if (/^https?:\/\//u.test(publicPath)) {
        return publicPath;
    }

    return `https://www.gredice.com${publicPath.startsWith('/') ? '' : '/'}${publicPath}`;
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
    const submitterFilterOptions = buildSubmitterFilterOptions(allRequests);
    const exactSubmitterIds = new Set(
        submitterFilterOptions.map((option) => option.value),
    );
    const filteredRequests = allRequests.filter(
        (request) =>
            (selectedStatus === 'all' || request.status === selectedStatus) &&
            (selectedEntityType === 'all' ||
                request.entityTypeName === selectedEntityType) &&
            requestMatchesAge(request, selectedAge) &&
            requestMatchesSubmitter(request, submitter, exactSubmitterIds),
    );

    return (
        <Stack spacing={4}>
            <Typography level="body2" className="text-muted-foreground">
                Prijedlozi za javni sadržaj direktorija
            </Typography>

            <CommunityEditsFilters submitters={submitterFilterOptions} />

            <Card>
                <CardOverflow>
                    <div className="min-w-0">
                        {filteredRequests.length === 0 ? (
                            <div className="p-4">
                                <NoDataPlaceholder>
                                    Nema prijedloga za odabrane filtre.
                                </NoDataPlaceholder>
                            </div>
                        ) : (
                            <ul className="divide-y">
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
                                        <li
                                            key={request.id}
                                            className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                                        >
                                            <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                <Stack
                                                    spacing={2}
                                                    className="min-w-0 xl:max-w-xl"
                                                >
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0"
                                                    >
                                                        <Link
                                                            href={KnownPages.CommunityEdit(
                                                                request.id,
                                                            )}
                                                            className="block min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
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
                                                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                                        <Typography
                                                            component="span"
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Zahtjev #
                                                            {request.id}
                                                        </Typography>
                                                        <Typography
                                                            component="span"
                                                            level="body3"
                                                            className="min-w-0 break-all text-muted-foreground"
                                                        >
                                                            {request.publicPath}
                                                        </Typography>
                                                    </div>
                                                </Stack>

                                                <Link
                                                    href={KnownPages.User(
                                                        request.submitterUserId,
                                                    )}
                                                    className="flex min-w-0 items-center gap-2 xl:w-64"
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

                                                <div className="flex shrink-0 flex-col gap-3 xl:items-end">
                                                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
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
                                                        <Chip
                                                            color="info"
                                                            size="sm"
                                                            variant="soft"
                                                        >
                                                            {
                                                                request.changes
                                                                    .length
                                                            }{' '}
                                                            promjena
                                                        </Chip>
                                                    </div>

                                                    <div className="grid gap-1 sm:grid-cols-2 xl:text-right">
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Predano:{' '}
                                                            <span className="whitespace-nowrap">
                                                                <LocalDateTime>
                                                                    {
                                                                        request.createdAt
                                                                    }
                                                                </LocalDateTime>
                                                            </span>
                                                        </Typography>
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Ažurirano:{' '}
                                                            <span className="whitespace-nowrap">
                                                                <LocalDateTime>
                                                                    {
                                                                        request.updatedAt
                                                                    }
                                                                </LocalDateTime>
                                                            </span>
                                                        </Typography>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 xl:justify-end">
                                                        <Button
                                                            href={KnownPages.CommunityEdit(
                                                                request.id,
                                                            )}
                                                            size="xs"
                                                            variant="outlined"
                                                        >
                                                            Detalji
                                                        </Button>
                                                        <Button
                                                            href={KnownPages.DirectoryEntity(
                                                                request.entityTypeName,
                                                                request.entityId,
                                                            )}
                                                            size="xs"
                                                            variant="outlined"
                                                        >
                                                            Admin zapis
                                                        </Button>
                                                        <Button
                                                            endDecorator={
                                                                <ExternalLink
                                                                    aria-hidden
                                                                    className="size-3.5"
                                                                />
                                                            }
                                                            href={publicPageUrl(
                                                                request.publicPath,
                                                            )}
                                                            rel="noreferrer"
                                                            size="xs"
                                                            target="_blank"
                                                            variant="outlined"
                                                        >
                                                            Javna stranica
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
