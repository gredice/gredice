import { Add } from "@signalco/ui-icons";
import { Button } from "@signalco/ui-primitives/Button";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Input } from "@signalco/ui-primitives/Input";
import { upsertAttributeDefinition } from "../../../../(actions)/definitionActions";

export const dynamic = 'force-dynamic';

function CreateAttributeDefinitionButton({ entityTypeName }: { entityTypeName: string }) {
    async function submitForm(formData: FormData) {
        'use server';

        const name = formData.get('name') as string;
        const label = formData.get('label') as string;
        const category = formData.get('category') as string;
        const dataType = formData.get('dataType') as string;

        await upsertAttributeDefinition({
            name,
            label,
            category,
            dataType,
            entityTypeName
        });
    }

    return (
        <Modal
            trigger={(
                <Button
                    variant="solid"
                    startDecorator={<Add className="size-5" />}>
                    Nova definicija
                </Button>
            )}
            title="Nova definicija">
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="h5">
                        Nova definicija atributa
                    </Typography>
                    <Typography level="body2">
                        Unesite podatke za novu definiciju atributa.
                    </Typography>
                </Stack>
                <form action={submitForm}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Input name="name" label="Naziv" />
                            <Input name="label" label="Labela" />
                            <Input name="category" label="Kategorija" />
                            <Input name="dataType" label="Vrsta podatka" />
                        </Stack>
                        <Button variant="solid" type="submit">Spremi</Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}

export default async function AttributesPage({ params }: { params: Promise<{ entityType: string }> }) {
    const { entityType } = await params;
    return (
        <Stack spacing={2} alignItems="center" className="py-8">
            <Typography level="body2" center>
                Odaberite definiciju atributa iz liste ili kreirajte novu.
            </Typography>
            <CreateAttributeDefinitionButton entityTypeName={entityType} />
        </Stack>
    );
}