import {
    type ExtendedAttributeDefinition,
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    type SelectAttributeDefinitionCategory,
} from '@gredice/storage';
import { SplitView } from '@signalco/ui/SplitView';
import {
    Binary,
    BookA,
    Bookmark,
    File,
    FontType,
    Hash,
    Tally3,
    ToggleRight,
} from '@signalco/ui-icons';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import type { HTMLAttributes } from 'react';
import { NoDataPlaceholder } from '../../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../../src/KnownPages';
import { CreateAttributeDefinitionButton } from './CreateAttributeDefinitionButton';
import { CreateAttributeDefinitionCategoryButton } from './CreateAttributeDefinitionCategoryButton';

function AttributeDataTypeIcon({
    dataType,
    ...rest
}: { dataType: string } & HTMLAttributes<SVGElement>) {
    if (dataType.startsWith('ref:')) {
        return <File {...rest} />;
    }
    switch (dataType) {
        case 'text':
            return <FontType {...rest} />;
        case 'number':
            return <Hash {...rest} />;
        case 'boolean':
            return <ToggleRight {...rest} />;
        case 'barcode':
            return <Tally3 {...rest} />;
        case 'markdown':
            return (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    {...rest}
                >
                    <title>Markdown</title>
                    <path d="M2 16V8l4 4 4-4v8" />
                    <path d="M18 8v8" />
                    <path d="m22 12-4 4-4-4" />
                </svg>
            );
        // case 'json': return <Text />;
        default:
            return <Binary {...rest} />;
    }
}

function AttributeDefinitionCard({
    attributeDefinition,
}: {
    attributeDefinition: ExtendedAttributeDefinition;
}) {
    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinition(
                attributeDefinition.entityTypeName,
                attributeDefinition.id,
            )}
        >
            <Card>
                <Row spacing={1}>
                    <AttributeDataTypeIcon
                        dataType={attributeDefinition.dataType}
                        className="size-5 text-muted-foreground"
                    />
                    <Stack>
                        <Typography level="body1">
                            {attributeDefinition.label}
                            {attributeDefinition.required && (
                                <span className="text-red-600/60 ml-1">*</span>
                            )}
                        </Typography>
                        <Typography level="body3" className="line-clamp-2">
                            {attributeDefinition.description}
                        </Typography>
                    </Stack>
                </Row>
            </Card>
        </Link>
    );
}

function AttributeDefinitionCategoryCard({
    attributeDefinitionCategory,
}: {
    attributeDefinitionCategory: SelectAttributeDefinitionCategory;
}) {
    return (
        <Link
            href={KnownPages.DirectoryEntityTypeAttributeDefinitionCategory(
                attributeDefinitionCategory.entityTypeName,
                attributeDefinitionCategory.id,
            )}
        >
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

export async function AttributeDefinitionsList({
    entityTypeName,
}: {
    entityTypeName: string;
}) {
    const attributeDefinitions = await getAttributeDefinitions(entityTypeName);
    const attributeDefinitionCategories =
        await getAttributeDefinitionCategories(entityTypeName);

    return (
        <SplitView minSize={220}>
            <Stack spacing={2} className="mr-4">
                <Row spacing={1} justifyContent="space-between">
                    <Row spacing={1}>
                        <Bookmark className="size-5 text-tertiary-foreground" />
                        <Typography level="body2" className="">
                            Kategorije
                        </Typography>
                    </Row>
                    <CreateAttributeDefinitionCategoryButton
                        entityTypeName={entityTypeName}
                    />
                </Row>
                <Stack spacing={1}>
                    {attributeDefinitionCategories.length <= 0 && (
                        <NoDataPlaceholder />
                    )}
                    {attributeDefinitionCategories.map((c) => (
                        <AttributeDefinitionCategoryCard
                            key={c.id}
                            attributeDefinitionCategory={c}
                        />
                    ))}
                </Stack>
            </Stack>
            <Stack spacing={2} className="ml-4">
                {attributeDefinitions.length <= 0 && <NoDataPlaceholder />}
                {attributeDefinitionCategories.map((category) => (
                    <Stack spacing={1} key={category.id}>
                        <Row spacing={1} justifyContent="space-between">
                            <Row spacing={1}>
                                <BookA className="size-5 text-tertiary-foreground" />
                                <Typography level="body2" className="">
                                    {category.label}
                                </Typography>
                            </Row>
                            <CreateAttributeDefinitionButton
                                entityTypeName={entityTypeName}
                                categoryName={category.name}
                            />
                        </Row>
                        {attributeDefinitions
                            .filter(
                                (attribute) =>
                                    attribute.category === category.name,
                            )
                            .map((attribute) => (
                                <AttributeDefinitionCard
                                    key={attribute.id}
                                    attributeDefinition={attribute}
                                />
                            ))}
                    </Stack>
                ))}
            </Stack>
        </SplitView>
    );
}