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
    /** Create a sandbox ("play") garden instead of a real garden. */
    isSandbox?: boolean;
    /** Called with the id of the newly created garden. */
    onCreated?: (gardenId: number) => void;
};

export function CreateGardenModal({
    open,
    onOpenChange,
    isSandbox,
    onCreated,
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
                is_sandbox: Boolean(isSandbox),
            });
            const created = await createGarden.mutateAsync({
                name: nextName,
                isSandbox,
            });
            setNewGardenName('');
            onOpenChange(false);
            if (created?.id != null) {
                onCreated?.(created.id);
            }
        } catch (error) {
            console.error('Failed to create garden', error);
        }
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={isSandbox ? 'Kreiraj vrt za igru' : 'Kreiraj novi vrt'}
        >
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
                        placeholder={
                            isSandbox
                                ? 'Unesite naziv vrta za igru...'
                                : 'Unesite naziv vrta...'
                        }
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
                        {isSandbox ? 'Kreiraj vrt za igru' : 'Kreiraj vrt'}
                    </Button>
                </Stack>
            </form>
        </Modal>
    );
}
