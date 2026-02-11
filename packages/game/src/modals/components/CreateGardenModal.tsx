import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardActions, CardContent } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type FormEvent, useState } from 'react';
import { useCreateGarden } from '../../hooks/useCreateGarden';

type CreateGardenModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function CreateGardenModal({
    open,
    onOpenChange,
}: CreateGardenModalProps) {
    const createGarden = useCreateGarden();
    const [newGardenName, setNewGardenName] = useState('');

    const trimmedNewGardenName = newGardenName.trim();
    const isCreateDisabled = !trimmedNewGardenName || createGarden.isPending;

    const handleCreateGarden = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextName = newGardenName.trim();
        if (!nextName) {
            return;
        }

        try {
            await createGarden.mutateAsync({ name: nextName });
            setNewGardenName('');
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to create garden', error);
        }
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Kreiraj novi vrt">
            <Card>
                <form onSubmit={handleCreateGarden}>
                    <CardContent noHeader>
                        <Stack spacing={3}>
                            <Stack spacing={1}>
                                <Typography level="body2">
                                    Kreiraj novi vrt. Novi vrt će dobiti početni
                                    raspored blokova.
                                </Typography>
                                <Input
                                    name="newGardenName"
                                    label="Naziv novog vrta"
                                    value={newGardenName}
                                    onChange={(event) =>
                                        setNewGardenName(event.target.value)
                                    }
                                    placeholder="Unesite naziv vrta..."
                                    required
                                    disabled={createGarden.isPending}
                                />
                            </Stack>
                        </Stack>
                    </CardContent>
                    <CardActions className="justify-end">
                        <Button
                            size="sm"
                            variant="solid"
                            type="submit"
                            loading={createGarden.isPending}
                            disabled={isCreateDisabled}
                        >
                            Kreiraj vrt
                        </Button>
                    </CardActions>
                </form>
            </Card>
        </Modal>
    );
}
