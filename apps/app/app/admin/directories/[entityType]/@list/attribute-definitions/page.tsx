import { ExtendedAttributeDefinition, getAttributeDefinitions, SelectAttributeDefinition } from "@gredice/storage";
import { Card, CardContent, CardHeader } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { BookA, Info } from "lucide-react";

export const dynamic = 'force-dynamic';

function AttributeDefinitionCard({ attributeDefinition }: { attributeDefinition: ExtendedAttributeDefinition }) {
    return (
        <Card>
            <Row spacing={1} justifyContent="space-between">
                <Stack>
                    <Typography level="body2">{attributeDefinition.categoryDefinition.label}</Typography>
                    <Typography>{attributeDefinition.label}</Typography>
                </Stack>
                <Stack>
                    <Chip className="">{
                        attributeDefinition.dataType.startsWith('json')
                            ? (
                                // TODO: Show dialog with JSON schema and data picker
                                <Row spacing={0.5} title={attributeDefinition.dataType.substring(5)}>
                                    <span>json</span>
                                    <Info className="size-4" />
                                </Row>) : attributeDefinition.dataType}
                    </Chip>
                </Stack>
            </Row>
        </Card>
    );
}

export default async function EntitiesAttributeDefinitionsListPage() {
    const attributeDefinitions = await getAttributeDefinitions('plant');

    return (
        <CardContent>
            <Stack spacing={2}>
                <Row spacing={1}>
                    <BookA className="size-5 text-tertiary-foreground" />
                    <Typography level="body2" className="">Atributi</Typography>
                </Row>
                <Stack spacing={1}>
                    {attributeDefinitions.map(a => (
                        <AttributeDefinitionCard key={a.id} attributeDefinition={a} />
                    ))}
                </Stack>
            </Stack>
        </CardContent>
    );
}