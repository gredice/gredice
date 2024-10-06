import { Typography } from "@signalco/ui-primitives/Typography";
import { getAttributeDefinitions, SelectAttributeDefinition } from '@gredice/storage';
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { BookA, Info } from "lucide-react";
import { Card } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";

export const dynamic = 'force-dynamic';

function AttributeDefinitionCard({ attributeDefinition }: { attributeDefinition: SelectAttributeDefinition }) {
    return (
        <Card>
            <Row spacing={2} justifyContent="space-between">
                <Stack>
                    <Typography level="body2">{attributeDefinition.category}</Typography>
                    <Typography>{attributeDefinition.label}</Typography>
                    <Typography level="body2">{attributeDefinition.name}</Typography>
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

export default async function AttributesPage() {
    const attributeDefinitions = await getAttributeDefinitions('plant');

    return (
        <Stack spacing={4}>
            <Row spacing={1}>
                <BookA />
                <Typography level="h4" className="font-semibold tracking-tight">Atributi</Typography>
            </Row>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attributeDefinitions.map(a => (
                    <AttributeDefinitionCard key={a.id} attributeDefinition={a} />
                ))}
            </div>
        </Stack>
    );
}