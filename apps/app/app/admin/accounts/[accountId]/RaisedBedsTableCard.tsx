import { Card, CardHeader, CardTitle, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { getAccountGardens, getAllRaisedBeds, getRaisedBeds } from "@gredice/storage";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import Link from "next/link";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { KnownPages } from "../../../../src/KnownPages";

export async function RaisedBedsTableCard({ accountId, gardenId }: { accountId?: string; gardenId?: number }) {
    const raisedBeds = accountId ?
        (await getAccountGardens(accountId)).flatMap(garden => garden.raisedBeds)
        : gardenId
            ? await getRaisedBeds(gardenId)
            : await getAllRaisedBeds();

    return (
        <Card>
            <CardHeader>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <CardTitle>Gredice</CardTitle>
                </div>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>ID</Table.Head>
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
                        {raisedBeds.map(bed => (
                            <Table.Row key={bed.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.RaisedBed(bed.id)}>
                                        {bed.id}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>{bed.name}</Table.Cell>
                                <Table.Cell>{bed.status}</Table.Cell>
                                <Table.Cell>{Array.isArray(bed.fields) ? bed.fields.length : 0}</Table.Cell>
                                <Table.Cell><LocaleDateTime>{bed.createdAt}</LocaleDateTime></Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}