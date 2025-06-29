import { getAccountGardens, getRaisedBeds } from "@gredice/storage";
import { Card, CardHeader, CardTitle, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import Link from "next/link";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { KnownPages } from "../../../../src/KnownPages";

export async function RaisedBedsTableCard({ accountId, gardenId }: { accountId?: string; gardenId?: number }) {
    const raisedBeds = accountId ?
        (await getAccountGardens(accountId)).flatMap(garden => garden.raisedBeds) :
        gardenId ? await getRaisedBeds(gardenId) : [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gredice</CardTitle>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>ID</Table.Head>
                            <Table.Head>Naziv</Table.Head>
                            <Table.Head>Status</Table.Head>
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
                        {raisedBeds.map(bed => (
                            <Table.Row key={bed.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.RaisedBed(bed.id)}>
                                        {bed.id}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>{bed.name}</Table.Cell>
                                <Table.Cell>{bed.status}</Table.Cell>
                                <Table.Cell><LocaleDateTime>{bed.createdAt}</LocaleDateTime></Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}