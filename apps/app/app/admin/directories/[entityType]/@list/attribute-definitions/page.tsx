import { ExtendedAttributeDefinition, getAttributeDefinitions } from "@gredice/storage";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { BookA, Info } from "lucide-react";
import { NoDataPlaceholder } from "../../../../../../components/shared/placeholders/NoDataPlaceholder";
import { Tooltip, TooltipContent, TooltipTrigger } from "@signalco/ui-primitives/Tooltip";
import Link from "next/link";
import { KnownPages } from "../../../../../../src/KnownPages";
export const dynamic = 'force-dynamic';

function AttributeDefinitionCard({ attributeDefinition }: { attributeDefinition: ExtendedAttributeDefinition }) {
    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinition(attributeDefinition.entityTypeName, attributeDefinition.id)}
            passHref
            legacyBehavior>
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
                                    <Tooltip delayDuration={0}>
                                        <TooltipTrigger>
                                            <Row spacing={0.5}>
                                                <span>json</span>
                                                <Info className="size-4" />
                                            </Row>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {/* TODO: Show dialog with JSON schema and data picker */}
                                            <Typography>{attributeDefinition.dataType.substring(5)}</Typography>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : attributeDefinition.dataType}
                        </Chip>
                    </Stack>
                </Row>
            </Card>
        </Link>
    );
}

export default async function EntitiesAttributeDefinitionsListPage({ params }: { params: Promise<{ entityType: string }> }) {
    const { entityType } = await params;
    const attributeDefinitions = await getAttributeDefinitions(entityType);

    return (
        <CardContent>
            <Stack spacing={2}>
                <Row spacing={1}>
                    <BookA className="size-5 text-tertiary-foreground" />
                    <Typography level="body2" className="">Atributi</Typography>
                </Row>
                <Stack spacing={1}>
                    {attributeDefinitions.length <= 0 && <NoDataPlaceholder />}
                    {attributeDefinitions.map(a => (
                        <AttributeDefinitionCard key={a.id} attributeDefinition={a} />
                    ))}
                </Stack>
            </Stack>
        </CardContent>
    );
}