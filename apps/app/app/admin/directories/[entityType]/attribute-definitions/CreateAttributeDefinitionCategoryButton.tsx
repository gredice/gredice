import { createAttributeDefinitionCategory } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Add } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
            <Stack spacing={4}>
                <Stack spacing={2}>
                    <Typography level="h5">Nova kategorija</Typography>
                    <Typography level="body2">
                        Unesite podatke za kategoriju.
                    </Typography>
                </Stack>
                <form action={submitForm}>
                    <Stack spacing={8}>
                        <Stack spacing={2}>
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
