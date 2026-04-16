import {
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    getEntityRaw,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Delete } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { notFound } from 'next/navigation';
import { importEntityData } from '../../../../../app/admin/directories/(actions)/importEntityData';
import { EntityAttributeProgress } from '../../../../../components/admin/directories/EntityAttributeProgress';
import { Field } from '../../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../../components/shared/fields/FieldSet';
import { ServerActionIconButton } from '../../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../../lib/auth/auth';
import { entityDisplayName } from '../../../../../src/entities/entityAttributes';
import { KnownPages } from '../../../../../src/KnownPages';
import { handleEntityDelete } from '../../../../(actions)/entityActions';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { EntityDetailsSaveIndicator } from './EntityDetailsSaveIndicator';
import { EntityDetailsSaveProvider } from './EntityDetailsSaveProvider';
import { EntityDetailsStickyHeader } from './EntityDetailsStickyHeader';
import { EntityImportMenu } from './EntityImportMenu';
import { EntityStateSelect } from './EntityStateSelect';

export const dynamic = 'force-dynamic';

export default async function EntityDetailsPage(props: {
    params: Promise<{ entityType: string; entityId: string }>;
}) {
    const params = await props.params;
    const [attributeDefinitions, attributeCategories, entity] =
        await Promise.all([
            getAttributeDefinitions(params.entityType),
            getAttributeDefinitionCategories(params.entityType),
            getEntityRaw(parseInt(params.entityId, 10)),
        ]);
    if (!entity) {
        notFound();
    }

    const entityDeleteBound = handleEntityDelete.bind(
        null,
        params.entityType,
        parseInt(params.entityId, 10),
    );

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

    return (
        <EntityDetailsSaveProvider>
            <Tabs defaultValue={attributeCategories.at(0)?.name}>
                <Stack spacing={2}>
                    <EntityDetailsStickyHeader
                        breadcrumbs={
                            <Breadcrumbs
                                items={[
                                    {
                                        label: entity.entityType.label,
                                        href: KnownPages.DirectoryEntityType(
                                            params.entityType,
                                        ),
                                    },
                                    { label: entityDisplayName(entity) },
                                ]}
                            />
                        }
                        tabs={
                            <TabsList>
                                {attributeCategories.map((category) => (
                                    <TabsTrigger
                                        key={category.name}
                                        value={category.name}
                                    >
                                        {category.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        }
                        actions={
                            <Row className="items-center" spacing={1}>
                                <EntityDetailsSaveIndicator />
                                <div className="w-28">
                                    <EntityAttributeProgress
                                        entity={entity}
                                        definitions={attributeDefinitions}
                                    />
                                </div>
                                <EntityStateSelect entity={entity} />
                                <EntityImportMenu importAction={importAction} />
                                <ServerActionIconButton
                                    title="Obriši"
                                    onClick={entityDeleteBound}
                                    variant="plain"
                                >
                                    <Delete />
                                </ServerActionIconButton>
                            </Row>
                        }
                    />
                    <Stack spacing={2}>
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
                                    value={
                                        entity.attributes.find(
                                            (a) =>
                                                a.attributeDefinitionId ===
                                                d.id,
                                        )?.value ?? '-'
                                    }
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
