import { ExtendedAttributeDefinition, SelectAttributeDefinitionCategory, getAttributeDefinitions, getAttributeDefinitionCategories } from "@gredice/storage";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Tooltip, TooltipTrigger, TooltipContent } from "@signalco/ui-primitives/Tooltip";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Info, Bookmark, BookA } from "lucide-react";
import { NoDataPlaceholder } from "../../../../../../components/shared/placeholders/NoDataPlaceholder";
import { KnownPages } from "../../../../../../src/KnownPages";
import Link from "next/link";

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
                        <Typography>
                            {attributeDefinition.label}
                            {attributeDefinition.required && <span className="text-red-600/60 ml-1">*</span>}
                        </Typography>
                        <Typography level="body3" className="line-clamp-2">{attributeDefinition.description}</Typography>
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

function AttributeDefinitionCategoryCard({ attributeDefinitionCategory }: { attributeDefinitionCategory: SelectAttributeDefinitionCategory }) {
    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinitionCategory(attributeDefinitionCategory.entityTypeName, attributeDefinitionCategory.id)}
            passHref
            legacyBehavior>
            <Card>
                <Row spacing={1} justifyContent="space-between">
                    <Stack>
                        <Typography level="body2">
                            {attributeDefinitionCategory.label}
                        </Typography>
                    </Stack>
                </Row>
            </Card>
        </Link>
    );
}

export async function AttributeDefinitionsList({ entityTypeName }: { entityTypeName: string }) {
    const attributeDefinitions = await getAttributeDefinitions(entityTypeName);
    const attributeDefinitionCategories = await getAttributeDefinitionCategories(entityTypeName);

    return (
        <CardContent>
            <Stack spacing={2}>
                <Row spacing={1}>
                    <Bookmark className="size-5 text-tertiary-foreground" />
                    <Typography level="body2" className="">Kategorije</Typography>
                </Row>
                <Stack spacing={1}>
                    {attributeDefinitionCategories.length <= 0 && <NoDataPlaceholder />}
                    {attributeDefinitionCategories.map(c => (
                        <AttributeDefinitionCategoryCard key={c.id} attributeDefinitionCategory={c} />
                    ))}
                </Stack>
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