import { getPlants } from '@gredice/storage';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';

export async function PlantsTable() {
    const plants = await getPlants();

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {plants.map(plant => (
                    <Table.Row key={plant.id}>
                        <Table.Cell>
                            <Link href={`/admin/plants/${plant.id}`}>
                                <Typography>{plant.name}</Typography>
                            </Link>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}