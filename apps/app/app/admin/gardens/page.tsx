import { getGardens } from "@gredice/storage";
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";

export const dynamic = 'force-dynamic';

export default async function GardensPage() {
    await auth(['admin']);
    const gardens = await getGardens();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {"Vrtovi"}
                    <Chip color="primary" size="sm">{gardens.length}</Chip>
                </CardTitle>
            </CardHeader>
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
                        {gardens.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema vrtova
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
                                <Table.Cell>
                                    <Link href={KnownPages.Account(garden.accountId)}>
                                        {garden.accountId}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell title={garden.createdAt.toISOString()}>
                                    <LocaleDateTime time={false}>
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