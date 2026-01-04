import {
    getEntitiesFormatted,
    getInventory,
    getLastInventoryUpdate,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Field } from '../../../../components/shared/fields/Field';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';

export async function AccountInventoryCard({
    accountId,
}: {
    accountId: string;
}) {
    const inventory = await getInventory(accountId);
    const lastUpdated = await getLastInventoryUpdate(accountId);

    const entityTypes = [
        ...new Set(inventory.map((item) => item.entityTypeName)),
    ];
    const entitiesResults = await Promise.all(
        entityTypes.map(async (entityTypeName) => ({
            entityTypeName,
            entities: await getEntitiesFormatted(entityTypeName),
        })),
    );

    const entitiesLookup: Record<string, EntityStandardized[]> = {};
    entitiesResults.forEach(({ entityTypeName, entities }) => {
        entitiesLookup[entityTypeName] = entities as EntityStandardized[];
    });

    const itemsWithNames = inventory
        .map((item) => {
            const entities = entitiesLookup[item.entityTypeName] || [];
            const entity = entities.find(
                (e) => e.id?.toString() === item.entityId,
            );
            const label =
                entity?.information?.label ||
                entity?.information?.name ||
                `${item.entityTypeName} ${item.entityId}`;

            return {
                ...item,
                label,
            };
        })
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const totalCount = inventory.reduce((sum, item) => sum + item.amount, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ruksak</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="grid grid-cols-2 gap-2">
                    <Stack spacing={2}>
                        <Field name="Ukupno predmeta" value={totalCount} />
                        <Field
                            name="Zadnja izmjena"
                            value={
                                lastUpdated ? (
                                    <LocalDateTime time={false}>
                                        {lastUpdated}
                                    </LocalDateTime>
                                ) : (
                                    'Nije dostupno'
                                )
                            }
                        />
                    </Stack>
                </div>
            </CardContent>
            <CardOverflow>
                <Divider />
                <div className="max-h-80 overflow-auto">
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Entitet</Table.Head>
                                <Table.Head>Tip</Table.Head>
                                <Table.Head>Količina</Table.Head>
                                <Table.Head>Ažurirano</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {itemsWithNames.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={4}>
                                        <NoDataPlaceholder>
                                            Nema predmeta u ruksaku
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {itemsWithNames.map((item) => (
                                <Table.Row
                                    key={`${item.entityTypeName}-${item.entityId}`}
                                >
                                    <Table.Cell>{item.label}</Table.Cell>
                                    <Table.Cell>
                                        {item.entityTypeName}
                                    </Table.Cell>
                                    <Table.Cell>{item.amount}</Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {item.updatedAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            </CardOverflow>
        </Card>
    );
}
