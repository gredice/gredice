import { getEntitiesRaw, getEntityTypes } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";

export const dynamic = 'force-dynamic';

function FactCard({ header, value, href }: { header: string, value: string | number, href?: string }) {
    return (
        <Card href={href}>
            <CardOverflow className="p-4">
                <Stack spacing={1}>
                    <Typography level="body2">{header}</Typography>
                    <Typography level="h3">{value}</Typography>
                </Stack>
            </CardOverflow>
        </Card>
    )
}

export default async function AdminPage() {
    const entityTypes = await getEntityTypes();
    const entitiesCounts = await Promise.all(entityTypes.map(async entityType => {
        const entities = await getEntitiesRaw(entityType.name);
        return {
            entityTypeName: entityType.name,
            label: entityType.label,
            count: entities.length
        };
    }));

    return (
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {entitiesCounts.map(({ label, count, entityTypeName }) => (
                <FactCard key={entityTypeName} header={label} value={count} href={`/admin/directories/${entityTypeName}`} />
            ))}
        </div>
    );
}