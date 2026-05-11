import {
    getAttributeDefinitions,
    getEntitiesRaw,
    getEntityTypeByName,
    getInventoryConfigByEntityTypeName,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { Add } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import Link from 'next/link';
import { EntityTypeMenu } from '../../../../components/admin/directories';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../components/admin/navigation';
import { FilterProvider } from '../../../../components/admin/providers';
import { SearchInput } from '../../../../components/admin/SearchInput';
import { EntitiesTable } from '../../../../components/admin/tables';
import { ServerActionIconButton } from '../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import {
    createEntity,
    duplicateEntity,
} from '../../../(actions)/entityActions';
import { EntitiesFilters } from './EntitiesFilters';

export const dynamic = 'force-dynamic';

function getEntityLabel(
    attributes: {
        attributeDefinition: { category: string; name: string };
        value: string | null;
    }[],
) {
    return (
        attributes.find(
            (attribute) =>
                attribute.attributeDefinition.category === 'information' &&
                attribute.attributeDefinition.name === 'label',
        )?.value ??
        attributes.find(
            (attribute) =>
                attribute.attributeDefinition.category === 'information' &&
                attribute.attributeDefinition.name === 'name',
        )?.value
    );
}

export default async function EntitiesPage({
    params,
    searchParams,
}: {
    params: Promise<{ entityType: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const { entityType: entityTypeName } = await params;
    const urlParams = await searchParams;
    const completionFilter =
        typeof urlParams.completion === 'string' ? urlParams.completion : '';
    const stateFilter =
        typeof urlParams.state === 'string' ? urlParams.state : '';
    const entityType = await getEntityTypeByName(entityTypeName);
    const createEntityBound = createEntity.bind(null, entityTypeName);
    const duplicateEntityBound = duplicateEntity.bind(null, entityTypeName);
    const [entities, attributeDefinitions, inventoryConfig] = await Promise.all(
        [
            getEntitiesRaw(entityTypeName),
            getAttributeDefinitions(entityTypeName),
            getInventoryConfigByEntityTypeName(entityTypeName),
        ],
    );
    const inventoryItems = inventoryConfig
        ? await getInventoryItemsByConfig(inventoryConfig.id)
        : [];
    const refDefinitions = attributeDefinitions.filter((definition) =>
        definition.dataType.startsWith('ref:'),
    );
    const refEntityTypes = Array.from(
        new Set(
            refDefinitions.map(
                (definition) => definition.dataType.split(':')[1],
            ),
        ),
    );
    const refEntitiesByType = await Promise.all(
        refEntityTypes.map(async (refEntityTypeName) => ({
            refEntityTypeName,
            entities: await getEntitiesRaw(refEntityTypeName, 'published'),
        })),
    );
    const refLabelsByDefinitionId = Object.fromEntries(
        refDefinitions.map((definition) => {
            const refEntityTypeName = definition.dataType.split(':')[1];
            const refEntities =
                refEntitiesByType.find(
                    (entry) => entry.refEntityTypeName === refEntityTypeName,
                )?.entities ?? [];
            return [
                definition.id,
                Object.fromEntries(
                    refEntities.map((entity) => [
                        entity.id.toString(),
                        getEntityLabel(entity.attributes) ??
                            `${entity.entityType.label} ${entity.id}`,
                    ]),
                ),
            ];
        }),
    );

    return (
        <FilterProvider>
            <Stack spacing={2}>
                <AdminPageHeader
                    breadcrumbs={
                        <AdminDirectoryBreadcrumbs
                            entityTypeName={entityTypeName}
                            entityTypeLabel={entityType?.label}
                        />
                    }
                    actions={
                        <Row spacing={1}>
                            {inventoryConfig && (
                                <Link
                                    href={KnownPages.InventoryConfig(
                                        inventoryConfig.id,
                                    )}
                                >
                                    <Row
                                        spacing={1}
                                        className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                                    >
                                        <span>Zaliha</span>
                                    </Row>
                                </Link>
                            )}
                            <SearchInput />
                            <ServerActionIconButton
                                variant="plain"
                                title="Dodaj zapis"
                                onClick={createEntityBound}
                            >
                                <Add className="size-5" />
                            </ServerActionIconButton>
                            {entityType && (
                                <EntityTypeMenu entityType={entityType} />
                            )}
                        </Row>
                    }
                    heading={entityType?.label ?? entityTypeName}
                />
                <h1 className="sr-only">
                    {entityType?.label ?? entityTypeName}
                </h1>
                <EntitiesFilters />
                <Card>
                    <CardOverflow>
                        <EntitiesTable
                            entityTypeName={entityTypeName}
                            entities={entities}
                            attributeDefinitions={attributeDefinitions}
                            inventoryItems={inventoryItems}
                            inventoryLowCountThreshold={
                                inventoryConfig?.lowCountThreshold
                            }
                            completionFilter={completionFilter}
                            stateFilter={stateFilter}
                            onDuplicate={duplicateEntityBound}
                            refLabelsByDefinitionId={refLabelsByDefinitionId}
                        />
                    </CardOverflow>
                </Card>
            </Stack>
        </FilterProvider>
    );
}
