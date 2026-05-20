import { slugify } from '@gredice/js/slug';
import {
    createInventoryItem,
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    getEntitiesRaw,
    getEntityRaw,
    getEntityRevisions,
    getInventoryConfigByEntityTypeName,
    getInventoryItemsByConfig,
    updateInventoryItem,
} from '@gredice/storage';
import { getEntityCompleteness } from '@gredice/storage/entityCompleteness';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { importEntityData } from '../../../../../app/admin/directories/(actions)/importEntityData';
import { EntityAttributeProgress } from '../../../../../components/admin/directories/EntityAttributeProgress';
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
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { EntityActions } from './EntityActions';
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

    return (
        <EntityDetailsSaveProvider>
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
                        <EntityLinksPanel entityId={entityId} />
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
            <div className="mb-3">
                <FieldSet className="max-w-sm">
                    <Field name="Slug" value={slugify(entityTitle)} />
                </FieldSet>
            </div>
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
                                    <Row spacing={1} className="items-center">
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
                                                    Nedostaju obavezni atributi
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
                    <Stack spacing={2}>
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
                        <FieldSet>
                            <Field
                                name="Datum kreiranja"
                                value={entity.createdAt}
                            />
                            <Field
                                name="Datum zadnje izmjene"
                                value={entity.updatedAt}
                            />
                            <Field
                                name="Datum objave"
                                value={entity.publishedAt}
                            />
                            {displayDefinitions.map((d) => (
                                <Field
                                    key={d.id}
                                    name={d.label}
                                    value={(() => {
                                        const value = entity.attributes.find(
                                            (a) =>
                                                a.attributeDefinitionId ===
                                                d.id,
                                        )?.value;
                                        if (!value) {
                                            return '-';
                                        }

                                        if (d.dataType === 'image') {
                                            const imageUrl =
                                                imageAttributeValue(value);
                                            if (imageUrl) {
                                                return (
                                                    <ImageViewer
                                                        src={imageUrl}
                                                        alt={d.label}
                                                        previewWidth={40}
                                                        previewHeight={40}
                                                    />
                                                );
                                            }
                                        }

                                        if (d.dataType === 'barcode') {
                                            return (
                                                <BarcodeValue value={value} />
                                            );
                                        }

                                        if (d.dataType.startsWith('ref:')) {
                                            return (
                                                refLabelsByDefinitionId[d.id]?.[
                                                    value
                                                ] ?? value
                                            );
                                        }

                                        return formatAttributeValueWithUnit(
                                            value,
                                            d.unit,
                                        );
                                    })()}
                                />
                            ))}
                        </FieldSet>
                    </Stack>
                    {[
                        ...attributeCategories,
                        { name: 'history', label: 'Povijest' },
                    ].map((category) => (
                        <TabsContent value={category.name} key={category.name}>
                            <AttributeCategoryDetails
                                entity={entity}
                                category={category}
                                attributeDefinitions={attributeDefinitions}
                            />
                        </TabsContent>
                    ))}

                    <TabsContent value="history" key="history">
                        <FieldSet>
                            {revisions.length === 0 ? (
                                <Field name="Povijest" value="Nema promjena" />
                            ) : (
                                <HistoryRevisionListClient
                                    revisions={revisions}
                                    attributeDefinitions={attributeDefinitions}
                                />
                            )}
                        </FieldSet>
                    </TabsContent>
                </Stack>
            </Tabs>
        </EntityDetailsSaveProvider>
    );
}
