import { getGardens } from '@gredice/storage';
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
import { GardensFilters } from './GardensFilters';

export const dynamic = 'force-dynamic';

export default async function GardensPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const params = await searchParams;

    // Get filter parameters
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-30-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    // Get all gardens
    const allGardens = await getGardens();

    // Apply filters
    let filteredGardens = allGardens;

    // Apply date filter
    if (fromDate) {
        filteredGardens = filteredGardens.filter((garden) => {
            return garden.createdAt && garden.createdAt >= fromDate;
        });
    }

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>
                    Vrtovi
                </Typography>
                <Chip color="primary">{filteredGardens.length}</Chip>
            </Row>

            <GardensFilters />

            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Naziv</Table.Head>
                                <Table.Head>Račun</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredGardens.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema vrtova
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {filteredGardens.map((garden) => (
                                <Table.Row key={garden.id}>
                                    <Table.Cell>
                                        <Link
                                            href={KnownPages.Garden(garden.id)}
                                        >
                                            {garden.name}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link
                                            href={KnownPages.Account(
                                                garden.accountId,
                                            )}
                                        >
                                            {garden.accountId}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {garden.createdAt}
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
