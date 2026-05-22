import { getFarms } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function FarmsPage() {
    await auth(['admin']);
    const farms = await getFarms();

    return (
        <Stack spacing={4}>
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
                            {farms.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema farmi
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {farms.map((farm) => (
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
