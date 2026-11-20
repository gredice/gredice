import {
    getAccountDisplayNames,
    getAccountGardens,
    getAllRaisedBedsFiltered,
    getRaisedBeds,
} from '@gredice/storage';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import { RaisedBedLatestPhotoThumbnail } from '../../../../components/raised-beds/RaisedBedLatestPhotoThumbnail';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';
import { RaisedBedStatusItems } from '../../raised-beds/[raisedBedId]/RaisedBedStatusItems';

export async function RaisedBedsTableCard({
    accountId,
    gardenId,
    searchParams,
    scroll,
}: {
    accountId?: string;
    gardenId?: number;
    searchParams?: { [key: string]: string | string[] | undefined };
    scroll?: boolean;
}) {
    // Get filter parameters
    const statusFilter =
        typeof searchParams?.status === 'string'
            ? searchParams.status
            : accountId || gardenId
              ? ''
              : 'active';

    // Prepare filter parameters
    const filters = {
        status: statusFilter || undefined,
    };

    // Fetch filtered data using the repository filtering functions.
    // Garden and account names replace internal IDs in the row labels.
    const gardenNames = new Map<number, string>();
    let raisedBeds: Awaited<ReturnType<typeof getRaisedBeds>>;
    if (accountId) {
        const accountGardens = await getAccountGardens(accountId, filters);
        for (const garden of accountGardens) {
            gardenNames.set(garden.id, garden.name);
        }
        raisedBeds = accountGardens.flatMap((garden) => garden.raisedBeds);
    } else if (gardenId) {
        raisedBeds = await getRaisedBeds(gardenId, filters);
    } else {
        const allRaisedBeds = await getAllRaisedBedsFiltered(filters);
        for (const bed of allRaisedBeds) {
            if (bed.gardenId && bed.gardenName) {
                gardenNames.set(bed.gardenId, bed.gardenName);
            }
        }
        raisedBeds = allRaisedBeds;
    }
    const accountNames = accountId
        ? new Map<string, string>()
        : await getAccountDisplayNames(
              raisedBeds.flatMap((bed) =>
                  bed.accountId ? [bed.accountId] : [],
              ),
          );

    const sortedRaisedBeds = [...raisedBeds].sort((a, b) => {
        if (a.physicalId && b.physicalId) {
            const physicalIdSort = a.physicalId.localeCompare(
                b.physicalId,
                'hr-HR',
                { numeric: true },
            );
            if (physicalIdSort !== 0) {
                return physicalIdSort;
            }
            return a.id - b.id;
        }
        if (a.physicalId) return -1;
        if (b.physicalId) return 1;
        return a.id - b.id;
    });

    return (
        <Card className={scroll ? scrollableTableCardClassName : undefined}>
            <CardHeader>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <CardTitle>Gredice</CardTitle>
                </div>
            </CardHeader>
            <CardOverflow
                className={
                    scroll ? scrollableTableCardOverflowClassName : undefined
                }
            >
                {sortedRaisedBeds.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>Nema gredica</NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {sortedRaisedBeds.map((bed) => {
                            const fields = Array.isArray(bed.fields)
                                ? bed.fields
                                : [];
                            const plantings = Array.isArray(bed.plantings)
                                ? bed.plantings
                                : [];
                            const activePlantingCount = plantings.filter(
                                (planting) => planting.isActive,
                            ).length;
                            const unknownLegacyLayoutCount = plantings.filter(
                                (planting) =>
                                    planting.isActive &&
                                    planting.configurationSource === 'legacy' &&
                                    planting.layoutKey === null,
                            ).length;
                            const statusItem = RaisedBedStatusItems.find(
                                (item) => item.value === bed.status,
                            );
                            const raisedBedHref = KnownPages.RaisedBed(bed.id);
                            const gardenLink =
                                !gardenId && bed.gardenId
                                    ? {
                                          id: bed.gardenId,
                                          label:
                                              gardenNames.get(bed.gardenId) ??
                                              `#${bed.gardenId}`,
                                      }
                                    : null;
                            const accountName =
                                !accountId && bed.accountId
                                    ? accountNames.get(bed.accountId)
                                    : undefined;
                            const accountLink =
                                bed.accountId && accountName
                                    ? { id: bed.accountId, label: accountName }
                                    : null;
                            const sproutedFieldPercentage =
                                (fields.filter(
                                    (field) => field.plantStatus === 'sprouted',
                                ).length /
                                    Math.max(fields.length, 9)) *
                                100;

                            return (
                                <li
                                    key={bed.id}
                                    className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                                >
                                    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-start gap-3">
                                                {bed.latestPhotoOperation && (
                                                    <Link
                                                        href={raisedBedHref}
                                                        className="shrink-0"
                                                    >
                                                        <RaisedBedLatestPhotoThumbnail
                                                            alt={`Zadnje fotografije gredice ${bed.name}`}
                                                            imageUrls={
                                                                bed
                                                                    .latestPhotoOperation
                                                                    .imageUrls
                                                            }
                                                        />
                                                    </Link>
                                                )}
                                                <Link
                                                    href={raisedBedHref}
                                                    className="group flex min-w-0 flex-1 items-start gap-2 underline-offset-4"
                                                >
                                                    <RaisedBedIcon
                                                        className="size-7 text-muted-foreground"
                                                        containerClassName="mt-0.5 h-8 min-w-8"
                                                        physicalId={
                                                            bed.physicalId
                                                        }
                                                    />
                                                    <span className="min-w-0">
                                                        <Typography
                                                            component="span"
                                                            level="body2"
                                                            semiBold
                                                            className="block min-w-0 break-words text-primary group-hover:underline"
                                                        >
                                                            {bed.name}
                                                        </Typography>
                                                        <Typography
                                                            component="span"
                                                            level="body3"
                                                            className="mt-0.5 block text-muted-foreground"
                                                        >
                                                            {bed.physicalId
                                                                ? `Fizički ID ${bed.physicalId}`
                                                                : `Gredica #${bed.id}`}
                                                        </Typography>
                                                    </span>
                                                </Link>
                                            </div>

                                            {gardenLink || accountLink ? (
                                                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-0 sm:pl-12">
                                                    {gardenLink ? (
                                                        <Link
                                                            href={KnownPages.Garden(
                                                                gardenLink.id,
                                                            )}
                                                            className="min-w-0 truncate text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                                                        >
                                                            Vrt:{' '}
                                                            {gardenLink.label}
                                                        </Link>
                                                    ) : null}
                                                    {accountLink ? (
                                                        <Link
                                                            href={KnownPages.Account(
                                                                accountLink.id,
                                                            )}
                                                            className="min-w-0 truncate text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                                                        >
                                                            Račun:{' '}
                                                            {accountLink.label}
                                                        </Link>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 flex-col gap-2 md:items-end">
                                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                                <Chip
                                                    className="w-fit"
                                                    size="sm"
                                                    startDecorator={
                                                        statusItem?.icon || 'ℹ️'
                                                    }
                                                    variant="soft"
                                                >
                                                    {statusItem?.label ||
                                                        bed.status}
                                                </Chip>
                                                <Chip
                                                    color="neutral"
                                                    size="sm"
                                                    variant="outlined"
                                                >
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <SegmentedCircularProgress
                                                            segments={[
                                                                {
                                                                    percentage: 100,
                                                                    color: 'stroke-yellow-500',
                                                                    trackColor:
                                                                        'bg-gray-200',
                                                                    value: sproutedFieldPercentage,
                                                                },
                                                            ]}
                                                            size={20}
                                                        >
                                                            {fields.length}
                                                        </SegmentedCircularProgress>
                                                        Broj polja
                                                    </span>
                                                </Chip>
                                                <Chip
                                                    color="info"
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    Aktivne sadnje:{' '}
                                                    {activePlantingCount}
                                                </Chip>
                                                {unknownLegacyLayoutCount >
                                                0 ? (
                                                    <Chip
                                                        color="warning"
                                                        size="sm"
                                                        variant="soft"
                                                    >
                                                        Nepoznat raspored:{' '}
                                                        {
                                                            unknownLegacyLayoutCount
                                                        }
                                                    </Chip>
                                                ) : null}
                                            </div>

                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground md:text-right"
                                            >
                                                Datum kreiranja:{' '}
                                                <span className="whitespace-nowrap">
                                                    <LocalDateTime>
                                                        {bed.createdAt}
                                                    </LocalDateTime>
                                                </span>
                                            </Typography>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
