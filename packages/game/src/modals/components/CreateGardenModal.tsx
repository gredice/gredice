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
            <form onSubmit={handleCreateGarden}>
                <Stack spacing={2}>
                    <Input
                        name="newGardenName"
                        label="Naziv novog vrta"
                        className="bg-card"
                        value={newGardenName}
                        onChange={(event) =>
                            setNewGardenName(event.target.value)
                        }
                        placeholder="Unesite naziv vrta..."
                        required
                        disabled={createGarden.isPending}
                    />
                    <Button
                        size="sm"
                        variant="solid"
                        type="submit"
                        loading={createGarden.isPending}
                        disabled={isCreateDisabled}
                    >
                        Kreiraj vrt
                    </Button>
                </Stack>
            </form>
        </Modal>
    );
}
