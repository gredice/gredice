import { Button } from "@signalco/ui-primitives/Button";
import { upsertAttributeDefinition } from "../../../../(actions)/definitionActions";
import { Add } from "@signalco/ui-icons";
import { Input } from "@signalco/ui-primitives/Input";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";

export function CreateAttributeDefinitionButton({ entityTypeName }: { entityTypeName: string }) {
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
                    startDecorator={<Add className="size-5" />}
                    fullWidth>
                    Novi atribut
                </Button>
            )}
            title="Nova definicija">
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="h5">
                        Novi atribut
                    </Typography>
                    <Typography level="body2">
                        Unesite podatke za novi atribut.
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
                        <Button variant="solid" type="submit">Kreiraj</Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}