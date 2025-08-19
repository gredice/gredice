import { Card, CardHeader, CardTitle, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { getAccountGardens, getAllRaisedBeds, getRaisedBeds } from "@gredice/storage";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import Link from "next/link";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { KnownPages } from "../../../../src/KnownPages";
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';

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
                            <Table.Head>Fizicka oznaka</Table.Head>
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
                                    return a.physicalId.localeCompare(b.physicalId, 'hr-HR', { numeric: true });
                                if (a.physicalId) return -1;
                                if (b.physicalId) return 1;
                                return a.id - b.id;
                            })
                            .sort((a, b) => {
                                if (a.physicalId === b.physicalId)
                                    return a.id - b.id;
                                return 0;
                            })
                            .map(bed => (
                                <Table.Row key={bed.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.RaisedBed(bed.id)}>
                                            {bed.id}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>{bed.name}</Table.Cell>
                                    <Table.Cell>{bed.physicalId}</Table.Cell>
                                    <Table.Cell>{bed.status}</Table.Cell>
                                    <Table.Cell>
                                        <SegmentedCircularProgress
                                            segments={[
                                                {
                                                    percentage: 100,
                                                    color: 'stroke-yellow-500',
                                                    trackColor: 'bg-gray-200',
                                                    value: (bed.fields.filter(field => field.plantStatus === 'sprouted').length / 9) * 100
                                                }
                                            ]}
                                            size={24}
                                        >
                                            {Array.isArray(bed.fields) ? bed.fields.length : 0}
                                        </SegmentedCircularProgress>
                                    </Table.Cell>
                                    <Table.Cell><LocalDateTime>{bed.createdAt}</LocalDateTime></Table.Cell>
                                </Table.Row>
                            ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}