import { getAccountGardens } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Table } from '@signalco/ui-primitives/Table';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';

export async function AccountGardensCard({ accountId }: { accountId: string }) {
    const gardens = await getAccountGardens(accountId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Vrtovi</CardTitle>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>ID</Table.Head>
                            <Table.Head>Naziv</Table.Head>
                            <Table.Head>Datum kreiranja</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {gardens.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema povezanih vrtova
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {gardens.map((garden) => (
                            <Table.Row key={garden.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.Garden(garden.id)}>
                                        {garden.id}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    <Link href={KnownPages.Garden(garden.id)}>
                                        {garden.name}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    <LocalDateTime>
                                        {garden.createdAt}
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