import { getAttributeDefinition, getEntityTypeByName } from '@gredice/storage';
import { Delete } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { notFound } from 'next/navigation';
import {
    AdminDirectoryBreadcrumbs,
    AdminPageHeader,
} from '../../../../../../components/admin/navigation';
import { ServerActionIconButton } from '../../../../../../components/shared/ServerActionIconButton';
import { KnownPages } from '../../../../../../src/KnownPages';
import { deleteAttributeDefinition } from '../../../../../(actions)/definitionActions';
import { FormCheckbox, FormDataTypeSelect, FormInput } from './Form';

export const dynamic = 'force-dynamic';

export default async function AttributeDefinitionPage({
    params,
}: {
    params: Promise<{ entityType: string; id: string }>;
}) {
    const { entityType: entityTypeName, id: idString } = await params;
    const id = parseInt(idString, 10);
    if (Number.isNaN(id) || id < 0) {
        notFound();
    }

    const entityType = await getEntityTypeByName(entityTypeName);
    const definition = await getAttributeDefinition(id);
    if (!definition || !entityType) {
        notFound();
    }

    const {
        name,
        category,
        dataType,
        defaultValue,
        unit,
        label,
        multiple,
        required,
        display,
    } = definition;

    const deleteAttributeDefinitionBound = deleteAttributeDefinition.bind(
        null,
        entityTypeName,
        id,
    );

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                breadcrumbs={
                    <AdminDirectoryBreadcrumbs
                        entityTypeName={entityTypeName}
                        entityTypeLabel={entityType.label}
                        items={[
                            {
                                label: 'Atributi',
                                href: KnownPages.DirectoryEntityTypeAttributeDefinitions(
                                    entityTypeName,
                                ),
                            },
                            { label: label },
                        ]}
                    />
                }
                actions={
                    <ServerActionIconButton
                        title="Obriši"
                        onClick={deleteAttributeDefinitionBound}
                        variant="plain"
                    >
                        <Delete className="size-5" />
                    </ServerActionIconButton>
                }
                heading={label}
            />
            <form>
                <Stack spacing={6}>
                    <FormInput
                        definition={definition}
                        name="category"
                        label="Kategorija"
                        value={category}
                    />
                    <Row spacing={4}>
                        <FormInput
                            definition={definition}
                            name="label"
                            label="Naziv"
                            value={label}
                        />
                        <FormInput
                            definition={definition}
                            name="name"
                            label="Oznaka"
                            value={name}
                        />
                    </Row>
                    <FormInput
                        definition={definition}
                        name="description"
                        label="Opis"
                        value={definition.description || ''}
                        placeholder="-"
                    />
                    <Stack spacing={4}>
                        <Row spacing={4}>
                            <FormDataTypeSelect
                                definition={definition}
                                value={dataType}
                            />
                            <FormInput
                                definition={definition}
                                name="defaultValue"
                                label="Zadana vrijednost"
                                value={defaultValue || ''}
                                placeholder="-"
                            />
                            <FormInput
                                definition={definition}
                                name="unit"
                                label="Jedinica"
                                value={unit || ''}
                                placeholder="°C, €, cm"
                            />
                        </Row>
                        <FormCheckbox
                            definition={definition}
                            name="multiple"
                            value={multiple ? 'true' : 'false'}
                            label="Više vrijednosti"
                        />
                    </Stack>
                    <FormCheckbox
                        definition={definition}
                        name="required"
                        value={required ? 'true' : 'false'}
                        label="Obavezno"
                    />
                    <FormCheckbox
                        definition={definition}
                        name="display"
                        value={display ? 'true' : 'false'}
                        label="Prikaži u tablici"
                    />
                </Stack>
            </form>
        </Stack>
    );
}
