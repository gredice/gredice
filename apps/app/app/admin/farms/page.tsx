import { getFarms } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { KnownPages } from '../../../src/KnownPages';
import { FarmsFilters } from './FarmsFilters';

export const dynamic = 'force-dynamic';

export default async function FarmsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const params = await searchParams;

    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-30-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    const allFarms = await getFarms();

    const filteredFarms = fromDate
        ? allFarms.filter(
              (farm) => farm.createdAt && farm.createdAt >= fromDate,
          )
        : allFarms;

    return (
        <Stack spacing={2}>
            <Row spacing={1} alignItems="center">
                <Typography level="h1" className="text-2xl" semiBold>
                    Farme
                </Typography>
                <Chip color="primary">{filteredFarms.length}</Chip>
            </Row>

            <FarmsFilters />

            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Naziv</Table.Head>
                                <Table.Head>Lokacija</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredFarms.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema farmi
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {filteredFarms.map((farm) => (
                                <Table.Row key={farm.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.Farm(farm.id)}>
                                            {farm.name}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {farm.latitude.toFixed(4)}°,{' '}
                                        {farm.longitude.toFixed(4)}°
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {farm.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
