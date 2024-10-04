import { Typography } from "@signalco/ui-primitives/Typography";
import { getAttributeDefinitions } from '@gredice/storage';
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";

export const dynamic = 'force-dynamic';

export default async function AttributesPage() {
    const attributes = await getAttributeDefinitions();

    return (
        <div className="p-2">
            <Card>
                <CardHeader>
                    <CardTitle>Attributes</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Entity Type</Table.Head>
                                <Table.Head>Category</Table.Head>
                                <Table.Head>Name</Table.Head>
                                <Table.Head>Data type</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {attributes.map(a => (
                                <Table.Row key={a.id}>
                                    <Table.Cell>
                                        <Typography>{a.entityType}</Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Typography>{a.category}</Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Typography>{a.name}</Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Typography>{a.dataType}</Typography>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </div>
    );
}