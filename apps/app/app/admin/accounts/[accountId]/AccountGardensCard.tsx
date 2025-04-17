import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { getAccountGardens, getAccountUsers } from "@gredice/storage";
import Link from "next/link";
import { KnownPages } from "../../../../src/KnownPages";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";

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
                        {gardens.map(garden => (
                            <Table.Row key={garden.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.Garden(garden.id)}>
                                        {garden.name}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell title={garden.createdAt.toISOString()}>
                                    <LocaleDateTime>
                                        {garden.createdAt}
                                    </LocaleDateTime>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}