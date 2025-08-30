import {
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    getEntityRaw,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Delete } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
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
import { Field } from '../../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../../components/shared/fields/FieldSet';
import { ServerActionIconButton } from '../../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../../lib/auth/auth';
import { entityDisplayName } from '../../../../../src/entities/entityAttributes';
import { KnownPages } from '../../../../../src/KnownPages';
import { handleEntityDelete } from '../../../../(actions)/entityActions';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
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

    return (
        <Tabs defaultValue={attributeCategories.at(0)?.name}>
            <Stack spacing={2}>
                <div className="flex flex-row justify-between items-center">
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
                    <Row className="self-end" spacing={1}>
                        <EntityStateSelect entity={entity} />
                        <ServerActionIconButton
                            title="Obriši"
                            onClick={entityDeleteBound}
                            variant="plain"
                        >
                            <Delete />
                        </ServerActionIconButton>
                    </Row>
                </div>
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
                        <Field name="Datum objave" value={entity.publishedAt} />
                    </FieldSet>
                    {/* Import JSON form */}
                    <form
                        action={importAction}
                        className="flex items-center gap-2"
                    >
                        <Input
                            label="Uvoz podataka"
                            type="file"
                            name="entityJson"
                            accept="application/json"
                            required
                        />
                        <Button type="submit" className="h-full">
                            Uvezi
                        </Button>
                    </form>
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
    );
}
