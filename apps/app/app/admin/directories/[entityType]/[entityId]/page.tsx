import { getAttributeDefinitionCategories, getAttributeDefinitions, getEntityRaw } from '@gredice/storage';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { ServerActionIconButton } from '../../../../../components/shared/ServerActionIconButton';
import { notFound } from 'next/navigation';
import { handleEntityDelete } from '../../../../(actions)/entityActions';
import { Delete } from '@signalco/ui-icons';
import { EntityStateSelect } from './EntityStateSelect';
import { Row } from '@signalco/ui-primitives/Row';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { KnownPages } from '../../../../../src/KnownPages';
import { entityDisplayName } from '../../../../../src/entities/entityAttributes';
import { Stack } from '@signalco/ui-primitives/Stack';
import { importEntityData } from '../../../../../app/admin/directories/(actions)/importEntityData';
import { auth } from '../../../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function EntityDetailsPage(props: { params: Promise<{ entityType: string, entityId: string }> }) {
    const params = await props.params;
    const [attributeDefinitions, attributeCategories, entity] = await Promise.all([
        getAttributeDefinitions(params.entityType),
        getAttributeDefinitionCategories(params.entityType),
        getEntityRaw(parseInt(params.entityId)),
    ]);
    if (!entity) {
        notFound();
    }

    const entityDeleteBound = handleEntityDelete.bind(null, params.entityType, parseInt(params.entityId));

    // Remove useFormState, use a plain form with server action
    async function importAction(formData: FormData) {
        'use server';
        await auth(['admin']);
        try {
            await importEntityData(params.entityType, parseInt(params.entityId), formData);
        } catch (e) {
            console.error('Error importing entity data:', e);
            // Optionally handle error
        }
    }

    return (
        <Tabs defaultValue={attributeCategories.at(0)?.name}>
            <Stack spacing={2}>
                <div className='flex flex-row justify-between items-center'>
                    <Breadcrumbs items={[
                        { label: entity.entityType.label, href: KnownPages.DirectoryEntityType(params.entityType) },
                        { label: entityDisplayName(entity) },
                    ]} />
                    <TabsList>
                        {attributeCategories.map((category) => (
                            <TabsTrigger key={category.name} value={category.name}>
                                {category.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <Row className='self-end' spacing={1}>
                        <EntityStateSelect entity={entity} />
                        <ServerActionIconButton
                            title='Obriši'
                            onClick={entityDeleteBound}
                            variant='plain'>
                            <Delete />
                        </ServerActionIconButton>
                    </Row>
                </div>
                {/* Import JSON form */}
                <form action={importAction} className="mb-4 flex items-center gap-2">
                    <input type="file" name="entityJson" accept="application/json" required />
                    <button type="submit" className="btn btn-primary">Import JSON</button>
                </form>
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