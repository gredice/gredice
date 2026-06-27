import {
    getAccountGardens,
    getAllRaisedBedsFiltered,
    getRaisedBeds,
} from '@gredice/storage';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Table } from '@gredice/ui/Table';
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

    // Fetch filtered data using the repository filtering functions
    const raisedBeds = accountId
        ? (await getAccountGardens(accountId, filters)).flatMap(
              (garden) => garden.raisedBeds,
          )
        : gardenId
          ? await getRaisedBeds(gardenId, filters)
          : await getAllRaisedBedsFiltered(filters);

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
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Naziv</Table.Head>
                            <Table.Head>Status</Table.Head>
                            <Table.Head>Broj Polja</Table.Head>
                            <Table.Head>Datum Kreiranja</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {raisedBeds.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={2}>
                                    <NoDataPlaceholder>
                                        Nema gredica
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {raisedBeds
                            .sort((a, b) => {
                                if (a.physicalId && b.physicalId)
                                    return a.physicalId.localeCompare(
                                        b.physicalId,
                                        'hr-HR',
                                        { numeric: true },
                                    );
                                if (a.physicalId) return -1;
                                if (b.physicalId) return 1;
                                return a.id - b.id;
                            })
                            .sort((a, b) => {
                                if (a.physicalId === b.physicalId)
                                    return a.id - b.id;
                                return 0;
                            })
                            .map((bed) => (
                                <Table.Row key={bed.id}>
                                    <Table.Cell>
                                        <Link
                                            href={KnownPages.RaisedBed(bed.id)}
                                        >
                                            <Row spacing={2}>
                                                {bed.latestPhotoOperation && (
                                                    <RaisedBedLatestPhotoThumbnail
                                                        alt={`Zadnje fotografije gredice ${bed.name}`}
                                                        imageUrls={
                                                            bed
                                                                .latestPhotoOperation
                                                                .imageUrls
                                                        }
                                                    />
                                                )}
                                                <RaisedBedIcon
                                                    className="size-6 shrink-0"
                                                    physicalId={bed.physicalId}
                                                />
                                                <span>{bed.name}</span>
                                            </Row>
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip
                                            className="w-fit"
                                            startDecorator={
                                                RaisedBedStatusItems.find(
                                                    (item) =>
                                                        item.value ===
                                                        bed.status,
                                                )?.icon || 'ℹ️'
                                            }
                                        >
                                            {RaisedBedStatusItems.find(
                                                (item) =>
                                                    item.value === bed.status,
                                            )?.label || bed.status}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <SegmentedCircularProgress
                                            segments={[
                                                {
                                                    percentage: 100,
                                                    color: 'stroke-yellow-500',
                                                    trackColor: 'bg-gray-200',
                                                    value:
                                                        (bed.fields.filter(
                                                            (field) =>
                                                                field.plantStatus ===
                                                                'sprouted',
                                                        ).length /
                                                            Math.max(
                                                                bed.fields
                                                                    .length,
                                                                9,
                                                            )) *
                                                        100,
                                                },
                                            ]}
                                            size={24}
                                        >
                                            {Array.isArray(bed.fields)
                                                ? bed.fields.length
                                                : 0}
                                        </SegmentedCircularProgress>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime>
                                            {bed.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}
