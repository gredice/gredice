import { slugify } from '@gredice/js/slug';
import {
    createInventoryItem,
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    getEntitiesRaw,
    getEntityRaw,
    getEntityRevisions,
    getEntityTypeByName,
    getInventoryConfigByEntityTypeName,
    getInventoryItemsByConfig,
    updateInventoryItem,
} from '@gredice/storage';
import { getEntityCompleteness } from '@gredice/storage/entityCompleteness';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Calendar, Code, ExternalLink } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { importEntityData } from '../../../../../app/admin/directories/(actions)/importEntityData';
import { EntityAttributeProgress } from '../../../../../components/admin/directories/EntityAttributeProgress';
import { EntityTypeIcon } from '../../../../../components/admin/directories/EntityTypeIcon';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../../components/admin/navigation';
import { AdminPageTitle } from '../../../../../components/admin/navigation/AdminPageTitle';
import { BarcodeValue } from '../../../../../components/shared/attributes/BarcodeValue';
import { formatAttributeValueWithUnit } from '../../../../../components/shared/attributes/formatAttributeValueWithUnit';
import { Field } from '../../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../../components/shared/fields/FieldSet';
import { auth } from '../../../../../lib/auth/auth';
import { entityDisplayName } from '../../../../../src/entities/entityAttributes';
import { KnownPages } from '../../../../../src/KnownPages';
import { handleEntityDelete } from '../../../../(actions)/entityActions';
import { AttributeDataTypeIcon } from '../attribute-definitions/AttributeDataTypes';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { EntityActions } from './EntityActions';
import { EntityDetailsPanelCard } from './EntityDetailsPanelCard';
import { EntityDetailsPropertiesLayout } from './EntityDetailsPropertiesLayout';
import { EntityDetailsPropertiesPanel } from './EntityDetailsPropertiesPanel';
import { EntityDetailsPropertiesProvider } from './EntityDetailsPropertiesProvider';
import { EntityDetailsPropertiesToggle } from './EntityDetailsPropertiesToggle';
import {
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from './EntityDetailsPropertyList';
import { EntityDetailsSaveIndicator } from './EntityDetailsSaveIndicator';
import { EntityDetailsSaveProvider } from './EntityDetailsSaveProvider';
import { EntityDetailsStickyHeader } from './EntityDetailsStickyHeader';
import { EntityInventoryCard } from './EntityInventoryCard';
import { EntityLinksPanel } from './EntityLinksPanel';
import { HistoryRevisionListClient } from './HistoryRevisionListClient';

export const dynamic = 'force-dynamic';

function imageAttributeValue(value: string) {
    try {
        const data = JSON.parse(value);
        if (data && typeof data.url === 'string') {
            return data.url;
        }
    } catch {
        // ignored intentionally
    }

    return null;
}

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

function refEntityTypeName(dataType: string) {
    return dataType.startsWith('ref:') ? dataType.substring(4) : null;
}

function booleanAttributeValue(value: string) {
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return null;
}

function entityIdFromReferenceValue(value: string) {
    const entityId = Number(value);
    return Number.isInteger(entityId) && entityId > 0 ? entityId : null;
}

export default async function EntityDetailsPage(props: {
    params: Promise<{ entityType: string; entityId: string }>;
}) {
    const params = await props.params;
    const entityId = parseInt(params.entityId, 10);
    const [
        attributeDefinitions,
        attributeCategories,
        entity,
        inventoryConfig,
        revisions,
    ] = await Promise.all([
        getAttributeDefinitions(params.entityType),
        getAttributeDefinitionCategories(params.entityType),
        getEntityRaw(entityId),
        getInventoryConfigByEntityTypeName(params.entityType),
        getEntityRevisions(entityId),
    ]);
    if (!entity) {
        notFound();
    }

    const inventoryItems = inventoryConfig
        ? await getInventoryItemsByConfig(inventoryConfig.id)
        : [];
    const entityInventoryItem = inventoryItems.find(
        (item) => item.entityId === entityId,
    );
    const entityTitle = entityDisplayName(entity);

    const entityDeleteBound = handleEntityDelete.bind(
        null,
        params.entityType,
        entityId,
    );
    async function upsertInventoryAction(formData: FormData) {
        'use server';
        await auth(['admin']);

        if (!inventoryConfig) {
            return;
        }

        const quantityParsed = Number.parseInt(
            (formData.get('quantity') as string) ?? '0',
            10,
        );
        const quantity = Number.isFinite(quantityParsed)
            ? Math.max(0, quantityParsed)
            : 0;
        const notes = (formData.get('notes') as string) || undefined;

        if (entityInventoryItem) {
            await updateInventoryItem({
                id: entityInventoryItem.id,
                entityId,
                trackingType: entityInventoryItem.trackingType,
                quantity,
                notes,
                lowCountThreshold:
                    entityInventoryItem.lowCountThreshold ?? undefined,
            });
        } else {
            await createInventoryItem({
                inventoryConfigId: inventoryConfig.id,
                entityId,
                trackingType: inventoryConfig.defaultTrackingType,
                quantity,
                notes,
            });
        }

        revalidatePath(KnownPages.DirectoryEntity(params.entityType, entityId));
        revalidatePath(KnownPages.InventoryConfig(inventoryConfig.id));
    }

    async function importAction(formData: FormData) {
        'use server';
        await auth(['admin']);
        try {
            await importEntityData(
                params.entityType,
                parseInt(params.entityId, 10),
                formData,
            );
        } catch (e) {
            console.error('Error importing entity data:', e);
            // Optionally handle error
        }
    }

    const displayDefinitions = attributeDefinitions.filter((d) => d.display);
    const refDefinitions = displayDefinitions.filter((definition) =>
        definition.dataType.startsWith('ref:'),
    );
    const refEntityTypes = Array.from(
        new Set(
            refDefinitions
                .map((definition) => refEntityTypeName(definition.dataType))
                .filter((name): name is string => Boolean(name)),
        ),
    );
    const refEntitiesByType = await Promise.all(
        refEntityTypes.map(async (refEntityType) => {
            const [entities, entityType] = await Promise.all([
                getEntitiesRaw(refEntityType, 'published'),
                getEntityTypeByName(refEntityType),
            ]);

            return {
                refEntityTypeName: refEntityType,
                entityType,
                entities,
            };
        }),
    );
    const refEntityTypesByName = Object.fromEntries(
        refEntitiesByType.map((entry) => [
            entry.refEntityTypeName,
            entry.entityType,
        ]),
    );
    const refLabelsByDefinitionId = Object.fromEntries(
        refDefinitions.map((definition) => {
            const refTypeName = refEntityTypeName(definition.dataType);
            const refEntities =
                refEntitiesByType.find(
                    (entry) => entry.refEntityTypeName === refTypeName,
                )?.entities ?? [];
            return [
                definition.id,
                Object.fromEntries(
                    refEntities.map((refEntity) => [
                        refEntity.id.toString(),
                        getEntityLabel(refEntity.attributes) ??
                            `${refEntity.entityType.label} ${refEntity.id}`,
                    ]),
                ),
            ];
        }),
    );
    const completeness = getEntityCompleteness(entity, attributeDefinitions);
    const categoriesWithMissingRequiredAttributes = new Set(
        completeness.missingRequiredDefinitions.map(
            (definition) => definition.category,
        ),
    );
    const propertyItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'slug',
            label: 'Slug',
            value: slugify(entityTitle),
            mono: true,
            visual: <Code className="size-4" aria-hidden />,
        },
        {
            id: 'created-at',
            label: 'Datum kreiranja',
            value: entity.createdAt,
            visual: <Calendar className="size-4" aria-hidden />,
        },
        {
            id: 'updated-at',
            label: 'Datum zadnje izmjene',
            value: entity.updatedAt,
            visual: <Calendar className="size-4" aria-hidden />,
        },
        {
            id: 'published-at',
            label: 'Datum objave',
            value: entity.publishedAt,
            visual: <Calendar className="size-4" aria-hidden />,
        },
        ...displayDefinitions.map((d) => {
            const value = entity.attributes.find(
                (a) => a.attributeDefinitionId === d.id,
            )?.value;
            const refTypeName = refEntityTypeName(d.dataType);
            const dataTypeIcon = refTypeName ? (
                <EntityTypeIcon
                    key={`attribute-${d.id}-icon`}
                    icon={refEntityTypesByName[refTypeName]?.icon}
                    className="size-4"
                />
            ) : (
                <AttributeDataTypeIcon
                    key={`attribute-${d.id}-icon`}
                    dataType={d.dataType}
                    className="size-4"
                    aria-hidden
                />
            );

            if (!value) {
                return {
                    id: `attribute-${d.id}`,
                    label: d.label,
                    value: '-',
                    visual: dataTypeIcon,
                };
            }

            if (d.dataType === 'image') {
                const imageUrl = imageAttributeValue(value);

                return {
                    id: `attribute-${d.id}`,
                    label: d.label,
                    value: imageUrl ? (
                        <ImageViewer
                            key={`attribute-${d.id}-image`}
                            src={imageUrl}
                            alt={d.label}
                            previewWidth={40}
                            previewHeight={40}
                        />
                    ) : (
                        '-'
                    ),
                    visual: dataTypeIcon,
                };
            }

            if (d.dataType === 'barcode') {
                return {
                    id: `attribute-${d.id}`,
                    label: d.label,
                    value: (
                        <BarcodeValue
                            key={`attribute-${d.id}-barcode`}
                            value={value}
                        />
                    ),
                    visual: dataTypeIcon,
                };
            }

            if (d.dataType === 'boolean') {
                return {
                    id: `attribute-${d.id}`,
                    label: d.label,
                    value:
                        booleanAttributeValue(value) ??
                        formatAttributeValueWithUnit(value, d.unit),
                    visual: dataTypeIcon,
                };
            }

            if (refTypeName) {
                const refEntityId = entityIdFromReferenceValue(value);
                const refEntityLabel =
                    refLabelsByDefinitionId[d.id]?.[value] ?? value;

                return {
                    id: `attribute-${d.id}`,
                    label: d.label,
                    value: refEntityId ? (
                        <Link
                            href={KnownPages.DirectoryEntity(
                                refTypeName,
                                refEntityId,
                            )}
                            className="inline-flex min-w-0 items-center gap-1.5 text-primary hover:underline"
                        >
                            <span className="min-w-0 truncate">
                                {refEntityLabel}
                            </span>
                            <ExternalLink
                                className="size-3.5 shrink-0"
                                aria-hidden
                            />
                        </Link>
                    ) : (
                        refEntityLabel
                    ),
                    visual: dataTypeIcon,
                };
            }

            return {
                id: `attribute-${d.id}`,
                label: d.label,
                value: formatAttributeValueWithUnit(value, d.unit),
                visual: dataTypeIcon,
            };
        }),
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
            {inventoryConfig && (
                <EntityInventoryCard
                    inventoryConfigId={inventoryConfig.id}
                    inventoryLowCountThreshold={
                        inventoryConfig.lowCountThreshold
                    }
                    entityInventoryItem={entityInventoryItem}
                    upsertInventoryAction={upsertInventoryAction}
                />
            )}
            <EntityLinksPanel entityId={entityId} />
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsSaveProvider>
            <EntityDetailsPropertiesProvider>
                <AdminPageTitle title={entityTitle} />
                <AdminPageHeader
                    breadcrumbs={
                        <Row spacing={2} className="min-w-0">
                            <div className="min-w-0">
                                <AdminDirectoryBreadcrumbs
                                    entityTypeName={params.entityType}
                                    entityTypeLabel={entity.entityType.label}
                                    items={[
                                        {
                                            label: entityDisplayName(entity),
                                        },
                                    ]}
                                />
                            </div>
                            <div className="w-20 shrink-0">
                                <EntityAttributeProgress
                                    entity={entity}
                                    definitions={attributeDefinitions}
                                />
                            </div>
                        </Row>
                    }
                    actions={
                        <Row className="items-center" spacing={1}>
                            <EntityDetailsSaveIndicator />
                            <EntityDetailsPropertiesToggle />
                            <EntityActions
                                entity={entity}
                                entityType={params.entityType}
                                importAction={importAction}
                                deleteAction={entityDeleteBound}
                            />
                        </Row>
                    }
                    heading={entityDisplayName(entity)}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Tabs defaultValue={attributeCategories.at(0)?.name}>
                        <EntityDetailsStickyHeader
                            tabs={
                                <TabsList>
                                    {[
                                        ...attributeCategories,
                                        { name: 'history', label: 'Povijest' },
                                    ].map((category) => (
                                        <TabsTrigger
                                            key={category.name}
                                            value={category.name}
                                        >
                                            <Row
                                                spacing={1}
                                                className="items-center"
                                            >
                                                <span>{category.label}</span>
                                                {categoriesWithMissingRequiredAttributes.has(
                                                    category.name,
                                                ) && (
                                                    <>
                                                        <span
                                                            className="size-2 rounded-full bg-red-500"
                                                            aria-hidden
                                                        />
                                                        <span className="sr-only">
                                                            Nedostaju obavezni
                                                            atributi
                                                        </span>
                                                    </>
                                                )}
                                            </Row>
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            }
                        />
                        <Stack spacing={2}>
                            {attributeCategories.map((category) => (
                                <TabsContent
                                    value={category.name}
                                    key={category.name}
                                >
                                    <AttributeCategoryDetails
                                        entity={entity}
                                        category={category}
                                        attributeDefinitions={
                                            attributeDefinitions
                                        }
                                    />
                                </TabsContent>
                            ))}

                            <TabsContent value="history" key="history">
                                {revisions.length === 0 ? (
                                    <FieldSet>
                                        <Field
                                            name="Povijest"
                                            value="Nema promjena"
                                        />
                                    </FieldSet>
                                ) : (
                                    <HistoryRevisionListClient
                                        revisions={revisions}
                                        attributeDefinitions={
                                            attributeDefinitions
                                        }
                                    />
                                )}
                            </TabsContent>
                        </Stack>
                    </Tabs>
                </EntityDetailsPropertiesLayout>
            </EntityDetailsPropertiesProvider>
        </EntityDetailsSaveProvider>
    );
}
