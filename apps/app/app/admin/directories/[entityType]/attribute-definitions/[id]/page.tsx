import { getAttributeDefinition, getEntityTypeByName } from "@gredice/storage";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { notFound } from "next/navigation";
import { ServerActionIconButton } from "../../../../../../components/shared/ServerActionIconButton";
import { Delete } from "@signalco/ui-icons";
import { deleteAttributeDefinition } from "../../../../../(actions)/definitionActions";
import { FormCheckbox, FormInput } from "./Form";
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../../../src/KnownPages";

export const dynamic = 'force-dynamic';

export default async function AttributeDefinitionPage({ params }: { params: Promise<{ entityType: string, id: string }> }) {
    const { entityType: entityTypeName, id: idString } = await params;
    const id = parseInt(idString);
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
        label,
        multiple,
        required
    } = definition;

    const deleteAttributeDefinitionBound = deleteAttributeDefinition.bind(null, entityTypeName, id);

    return (
        <Card>
            <CardHeader>
                <Row spacing={1} justifyContent="space-between">
                    <CardTitle>
                        <Breadcrumbs items={[
                            { label: entityType.label, href: KnownPages.DirectoryEntityType(entityTypeName) },
                            { label: "Atributi", href: KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName) },
                            { label: label },
                        ]} />
                    </CardTitle>
                    <ServerActionIconButton
                        title="Obriši"
                        onClick={deleteAttributeDefinitionBound}
                        variant='plain'>
                        <Delete className="size-5" />
                    </ServerActionIconButton>
                </Row>
            </CardHeader>
            <CardContent>
                <form>
                    <Stack spacing={3}>
                        <FormInput definition={definition} name="category" label="Kategorija" value={category} />
                        <Row spacing={2}>
                            <FormInput definition={definition} name="label" label="Naziv" value={label} />
                            <FormInput definition={definition} name="name" label="Oznaka" value={name} />
                        </Row>
                        <FormInput definition={definition} name="description" label="Opis" value={definition.description || ''} />
                        <Stack spacing={2}>
                            <Row spacing={2}>
                                <FormInput definition={definition} name="dataType" label="Tip podatka" value={dataType} />
                                <FormInput definition={definition} name="defaultValue" label="Zadana vrijednost" value={defaultValue || ''} />
                            </Row>
                            <FormCheckbox definition={definition} name="multiple" value={multiple ? 'true' : 'false'} label="Više vrijednosti" />
                        </Stack>
                        <FormCheckbox definition={definition} name="required" value={required ? 'true' : 'false'} label="Obavezno" />
                    </Stack>
                </form>
            </CardContent>
        </Card>
    );
}