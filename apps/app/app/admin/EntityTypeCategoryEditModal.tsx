import { Edit } from "@signalco/ui-icons";
import { Input } from "@signalco/ui-primitives/Input";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Button } from "@signalco/ui-primitives/Button";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { updateEntityTypeCategory, removeEntityTypeCategory } from "../(actions)/entityTypeCategoryActions";
import { SelectEntityTypeCategory } from "@gredice/storage";
import { ModalConfirm } from "@signalco/ui/ModalConfirm";

interface EntityTypeCategoryEditModalProps {
    category: SelectEntityTypeCategory;
}

export function EntityTypeCategoryEditModal({ category }: EntityTypeCategoryEditModalProps) {
    async function handleUpdate(formData: FormData) {
        'use server';

        const name = formData.get('name') as string;
        const label = formData.get('label') as string;

        await updateEntityTypeCategory(category.id, name, label);
    }

    async function handleDelete() {
        'use server';
        await removeEntityTypeCategory(category.id);
    }

    return (
        <Modal
            trigger={(
                <IconButton title="Uredi kategoriju" variant="plain">
                    <Edit className="size-4" />
                </IconButton>
            )}
            title={"Uredi kategoriju"}>
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="h5">
                        Uredi kategoriju tipova zapisa
                    </Typography>
                    <Typography level="body2">
                        Uredite podatke za kategoriju tipova zapisa.
                    </Typography>
                </Stack>
                <form action={handleUpdate}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Input name="name" label="Naziv" defaultValue={category.name} required />
                            <Input name="label" label="Labela" defaultValue={category.label} required />
                        </Stack>
                        <Stack spacing={2}>
                            <Button variant="solid" type="submit">Spremi</Button>
                            <ModalConfirm
                                title="Potvrdi brisanje"
                                header={`Jeste li sigurni da želite obrisati kategoriju "${category.label}"? Ova akcija se ne može poništiti.`}
                                onConfirm={handleDelete}
                            />
                        </Stack>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
