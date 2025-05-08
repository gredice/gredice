import { getAllRaisedBeds } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function RaisedBedsPage() {
    await auth(['admin']);
    const raisedBeds = await getAllRaisedBeds();

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>Podignuti Kreveti</Typography>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
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
                                    <Table.Cell title={bed.createdAt.toISOString()}>
                                        <LocaleDateTime time={false}>
                                            {bed.createdAt}
                                        </LocaleDateTime>
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