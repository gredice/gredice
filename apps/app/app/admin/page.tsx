import { getAttributeDefinitions, getPlants } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Container } from "@signalco/ui-primitives/Container";

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
    const plants = await getPlants();
    const attributeDefinitions = await getAttributeDefinitions();

    return (
        <Container>
            <div className="py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <FactCard header="Biljaka" value={plants.length} href={'/admin/plants'} />
            <FactCard header="Definicija atributa" value={attributeDefinitions.length} href={'/admin/attributes'} />
        </div>
        </Container>
    );
}