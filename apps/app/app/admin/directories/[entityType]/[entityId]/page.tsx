import {
    createInventoryItem,
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    getEntityRaw,
    getInventoryConfigByEntityTypeName,
    getInventoryItemsByConfig,
    updateInventoryItem,
} from '@gredice/storage';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { ExternalLink } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { importEntityData } from '../../../../../app/admin/directories/(actions)/importEntityData';
import { EntityAttributeProgress } from '../../../../../components/admin/directories/EntityAttributeProgress';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
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
import { EntityLinksPanel } from './EntityLinksPanel';

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

export default async function EntityDetailsPage(props: {
    params: Promise<{ entityType: string; entityId: string }>;
}) {
    const params = await props.params;
    const entityId = parseInt(params.entityId, 10);
    const [attributeDefinitions, attributeCategories, entity, inventoryConfig] =
        await Promise.all([
            getAttributeDefinitions(params.entityType),
            getAttributeDefinitionCategories(params.entityType),
            getEntityRaw(entityId),
            getInventoryConfigByEntityTypeName(params.entityType),
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

    const entityDeleteBound = handleEntityDelete.bind(
        null,
        params.entityType,
        entityId,
    );
    const effectiveLowCountThreshold =
        entityInventoryItem?.lowCountThreshold ??
        inventoryConfig?.lowCountThreshold;
    const isLowInventory =
        effectiveLowCountThreshold !== null &&
        effectiveLowCountThreshold !== undefined &&
        (entityInventoryItem?.quantity ?? 0) <= effectiveLowCountThreshold;

    async function upsertInventoryAction(formData: FormData) {
        'use server';
        await auth(['admin']);

        if (!inventoryConfig) {
            return;
        }

        const trackingType =
            (formData.get('trackingType') as string) ||
            inventoryConfig.defaultTrackingType;
        const quantityRaw = formData.get('quantity');
        const quantityParsed = Number.parseInt(
            typeof quantityRaw === 'string' ? quantityRaw : '0',
            10,
        );
        const quantity = Number.isFinite(quantityParsed)
            ? Math.max(0, quantityParsed)
            : 0;
        const notes = (formData.get('notes') as string) || undefined;
        const lowCountThresholdRaw = formData.get('lowCountThreshold');
        const lowCountThresholdParsed = Number.parseInt(
            typeof lowCountThresholdRaw === 'string'
                ? lowCountThresholdRaw
                : '',
            10,
        );
        const lowCountThreshold = Number.isFinite(lowCountThresholdParsed)
            ? Math.max(0, lowCountThresholdParsed)
            : undefined;

        if (entityInventoryItem) {
            await updateInventoryItem({
                id: entityInventoryItem.id,
                entityId,
                trackingType,
                quantity,
                notes,
                lowCountThreshold,
            });
        } else {
            await createInventoryItem({
                inventoryConfigId: inventoryConfig.id,
                entityId,
                trackingType,
                quantity,
                notes,
                lowCountThreshold,
            });
        }

        revalidatePath(KnownPages.DirectoryEntity(params.entityType, entityId));
        revalidatePath(KnownPages.InventoryConfig(inventoryConfig.id));
    }

    // Remove useFormState, use a plain form with server action
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
    const populatedAttributeDefinitionIds = new Set(
        entity.attributes
            .filter((attribute) => (attribute.value?.length ?? 0) > 0)
            .map((attribute) => attribute.attributeDefinitionId),
    );
    const categoriesWithMissingRequiredAttributes = new Set(
        attributeDefinitions
            .filter(
                (definition) =>
                    definition.required &&
                    !definition.defaultValue &&
                    !populatedAttributeDefinitionIds.has(definition.id),
            )
            .map((definition) => definition.category),
    );

    return (
        <EntityDetailsSaveProvider>
            <Tabs defaultValue={attributeCategories.at(0)?.name}>
                <EntityDetailsStickyHeader
                    breadcrumbs={
                        <Row spacing={2} className="min-w-0">
                            <div className="min-w-0">
                                <Breadcrumbs
                                    items={[
                                        {
                                            label: (
                                                <AdminBreadcrumbLevelSelector />
                                            ),
                                            href: KnownPages.Directories,
                                        },
                                        {
                                            label: entity.entityType.label,
                                            href: KnownPages.DirectoryEntityType(
                                                params.entityType,
                                            ),
                                        },
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
                    tabs={
                        <TabsList>
                            {attributeCategories.map((category) => (
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
                    actions={
                        <Row className="items-center" spacing={1}>
                            <EntityDetailsSaveIndicator />
                            <EntityLinksPanel entityId={entityId} />
                            <EntityActions
                                entity={entity}
                                importAction={importAction}
                                deleteAction={entityDeleteBound}
                            />
                        </Row>
                    }
                />
                <Stack spacing={2}>
                    <Stack spacing={2}>
                        {inventoryConfig && (
                            <Card>
                                <CardHeader>
                                    <Row
                                        justifyContent="space-between"
                                        className="items-center"
                                    >
                                        <CardTitle>
                                            Zaliha za ovaj entitet
                                        </CardTitle>
                                        <Link
                                            href={KnownPages.InventoryConfig(
                                                inventoryConfig.id,
                                            )}
                                        >
                                            <IconButton
                                                variant="plain"
                                                title="Otvori stranicu zalihe"
                                            >
                                                <ExternalLink className="size-4" />
                                            </IconButton>
                                        </Link>
                                    </Row>
                                </CardHeader>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Row spacing={4} className="flex-wrap">
                                            <Field
                                                name="Stanje"
                                                value={
                                                    entityInventoryItem
                                                        ? entityInventoryItem.trackingType ===
                                                          'serialNumber'
                                                            ? 'Serijski broj'
                                                            : 'Komadi'
                                                        : 'Nema u zalihi'
                                                }
                                            />
                                            <Field
                                                name="Količina"
                                                value={
                                                    entityInventoryItem?.quantity ??
                                                    0
                                                }
                                            />
                                            <Field
                                                name="Niska količina"
                                                value={
                                                    effectiveLowCountThreshold ??
                                                    '-'
                                                }
                                            />
                                            <Field
                                                name="Indikator"
                                                value={
                                                    isLowInventory
                                                        ? 'Niska zaliha'
                                                        : 'U redu'
                                                }
                                            />
                                        </Row>

                                        <form action={upsertInventoryAction}>
                                            <Row
                                                spacing={2}
                                                className="items-end flex-wrap"
                                            >
                                                <SelectItems
                                                    name="trackingType"
                                                    label="Stanje"
                                                    items={[
                                                        {
                                                            value: 'pieces',
                                                            label: 'Komadi',
                                                        },
                                                        {
                                                            value: 'serialNumber',
                                                            label: 'Serijski broj',
                                                        },
                                                    ]}
                                                    defaultValue={
                                                        entityInventoryItem?.trackingType ??
                                                        inventoryConfig.defaultTrackingType
                                                    }
                                                />
                                                <Input
                                                    name="quantity"
                                                    label="Količina"
                                                    type="number"
                                                    min={0}
                                                    defaultValue={String(
                                                        entityInventoryItem?.quantity ??
                                                            0,
                                                    )}
                                                />
                                                <Input
                                                    name="notes"
                                                    label="Bilješka"
                                                    defaultValue={
                                                        entityInventoryItem?.notes ??
                                                        ''
                                                    }
                                                />
                                                <Input
                                                    name="lowCountThreshold"
                                                    label="Niska količina (opcionalno)"
                                                    type="number"
                                                    min={0}
                                                    defaultValue={
                                                        entityInventoryItem?.lowCountThreshold?.toString() ??
                                                        ''
                                                    }
                                                    helperText="Ako nije definirano, koristi se postavka tipa entiteta."
                                                />
                                                <Button
                                                    type="submit"
                                                    variant="solid"
                                                    className="w-fit"
                                                >
                                                    {entityInventoryItem
                                                        ? 'Ažuriraj zalihu'
                                                        : 'Dodaj u zalihu'}
                                                </Button>
                                            </Row>
                                        </form>
                                    </Stack>
                                </CardContent>
                            </Card>
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

                                        return formatAttributeValueWithUnit(
                                            value,
                                            d.unit,
                                        );
                                    })()}
                                />
                            ))}
                        </FieldSet>
                    </Stack>
                    {attributeCategories.map((category) => (
                        <TabsContent value={category.name} key={category.name}>
                            <AttributeCategoryDetails
                                entity={entity}
                                category={category}
                                attributeDefinitions={attributeDefinitions}
                            />
                        </TabsContent>
                    ))}
                </Stack>
            </Tabs>
        </EntityDetailsSaveProvider>
    );
}
