import { getAttributeDefinitionCategories } from "@gredice/storage";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { notFound } from "next/navigation";
import { FormInput } from "./Form";

export default async function AttributeDefinitionCategoryDetailsPage({ params }: { params: Promise<{ entityType: string, id: string }> }) {
    const { entityType: entityTypeName, id: idString } = await params;
    const id = parseInt(idString);
    if (Number.isNaN(id) || id < 0) {
        notFound();
    }

    const categories = await getAttributeDefinitionCategories(entityTypeName);
    const category = categories.find(c => c.id === id);
    if (!category) {
        notFound();
    }

    const {
        name,
        label,
    } = category;

    return (
        <form>
            <Stack spacing={3}>
                <Row spacing={1} justifyContent="space-between">
                    <Typography level='h5'>{label}</Typography>
                </Row>
                <Row spacing={2}>
                    <FormInput category={category} name="label" label="Naziv" value={label} />
                    <FormInput category={category} name="name" label="Oznaka" value={name} />
                </Row>
            </Stack>
        </form>
    );
}