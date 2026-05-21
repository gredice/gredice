import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { type SubmitEvent, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
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
    const { track } = useGameAnalytics();
    const [newGardenName, setNewGardenName] = useState('');

    const trimmedNewGardenName = newGardenName.trim();
    const isCreateDisabled = !trimmedNewGardenName || createGarden.isPending;

    const handleCreateGarden = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextName = newGardenName.trim();
        if (!nextName) {
            return;
        }

        try {
            track('game_garden_create_submitted', {
                name_length: nextName.length,
            });
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
                <Stack spacing={4}>
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
