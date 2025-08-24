import { createAttributeDefinitionCategory } from '@gredice/storage';
import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { auth } from '../../../../../lib/auth/auth';

export function CreateAttributeDefinitionCategoryButton({
    entityTypeName,
}: {
    entityTypeName: string;
}) {
    async function submitForm(formData: FormData) {
        'use server';
        await auth(['admin']);

        const name = formData.get('name') as string;
        const label = formData.get('label') as string;

        await createAttributeDefinitionCategory({
            name,
            label,
            entityTypeName,
        });
    }

    return (
        <Modal
            trigger={
                <IconButton variant="plain" title="Dodaj kategoriju">
                    <Add className="size-5" />
                </IconButton>
            }
            title="Nova definicija"
        >
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="h5">Nova kategorija</Typography>
                    <Typography level="body2">
                        Unesite podatke za kategoriju.
                    </Typography>
                </Stack>
                <form action={submitForm}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Input name="name" label="Naziv" />
                            <Input name="label" label="Labela" />
                        </Stack>
                        <Button variant="solid" type="submit">
                            Kreiraj
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
