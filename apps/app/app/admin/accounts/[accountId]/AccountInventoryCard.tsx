import {
    getEntitiesFormatted,
    getInventory,
    getLastInventoryUpdate,
} from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
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
        <Card className={scrollableTableCardClassName}>
            <CardHeader>
                <CardTitle>Ruksak</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="grid grid-cols-2 gap-2">
                    <Stack spacing={4}>
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
            <CardOverflow className={scrollableTableCardOverflowClassName}>
                {itemsWithNames.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema predmeta u ruksaku
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {itemsWithNames.map((item) => (
                            <li
                                key={`${item.entityTypeName}-${item.entityId}`}
                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <Stack spacing={1} className="min-w-0">
                                        <Typography
                                            level="body2"
                                            semiBold
                                            className="min-w-0 break-words"
                                        >
                                            {item.label}
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {item.entityTypeName}
                                        </Typography>
                                    </Stack>
                                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                        <Chip
                                            color="neutral"
                                            size="sm"
                                            variant="soft"
                                            className="w-fit"
                                        >
                                            {item.amount.toLocaleString(
                                                'hr-HR',
                                            )}{' '}
                                            kom
                                        </Chip>
                                        <Typography
                                            component="div"
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Ažurirano:{' '}
                                            <LocalDateTime time={false}>
                                                {item.updatedAt}
                                            </LocalDateTime>
                                        </Typography>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
