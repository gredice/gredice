import { Add, Book } from "@signalco/ui-icons";
import { Input } from "@signalco/ui-primitives/Input";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Button } from "@signalco/ui-primitives/Button";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { createEntityTypeCategory } from "../(actions)/entityTypeCategoryActions";

export function EntityTypeCategoryCreateModal() {
    async function handleSubmit(formData: FormData) {
        'use server';

        const name = formData.get('name') as string;
        const label = formData.get('label') as string;

        await createEntityTypeCategory(name, label);
    }

    return (
        <Modal
            trigger={(
                <IconButton title="Dodaj novu kategoriju" variant="plain">
                    <div className="size-4 relative">
                        <Book className="size-4 shrink-0 opacity-60" />
                        <Add className="absolute inset-0 size-3 left-0.5" />
                    </div>
                </IconButton>
            )}
            title={"Nova kategorija"}>
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="h5">
                        Nova kategorija tipova zapisa
                    </Typography>
                    <Typography level="body2">
                        Unesite podatke za novu kategoriju tipova zapisa.
                    </Typography>
                </Stack>
                <form action={handleSubmit}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Input name="name" label="Naziv" required />
                            <Input name="label" label="Labela" required />
                        </Stack>
                        <Button variant="solid" type="submit">Spremi</Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
