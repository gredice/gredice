import { Button } from '@gredice/ui/Button';
import { Card, CardActions, CardContent } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, useEffect, useState } from 'react';
import { useRenameGarden } from '../../hooks/useRenameGarden';

type GardenNameCardProps = {
    gardenId: number;
    gardenName: string;
    gardenCreatedAt?: string | Date;
};

const memberFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    year: 'numeric',
});

export function GardenNameCard({
    gardenId,
    gardenName,
    gardenCreatedAt,
}: GardenNameCardProps) {
    const renameGarden = useRenameGarden(gardenId);
    const [name, setName] = useState(gardenName);

    useEffect(() => {
        setName(gardenName);
    }, [gardenName]);

    const trimmedName = name.trim();
    const isRenameDisabled =
        !trimmedName ||
        trimmedName === gardenName.trim() ||
        renameGarden.isPending;

    const handleRenameGarden = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextName = name.trim();
        if (!nextName) {
            return;
        }

        try {
            await renameGarden.mutateAsync({ name: nextName });
        } catch (error) {
            console.error('Failed to rename garden', error);
        }
    };

    const createdAtDisplay = gardenCreatedAt
        ? memberFormatter.format(new Date(gardenCreatedAt))
        : undefined;

    return (
        <Card>
            <form onSubmit={handleRenameGarden}>
                <CardContent noHeader>
                    <Stack spacing={3}>
                        <Stack spacing={1}>
                            <Input
                                name="gardenName"
                                label="Naziv vrta"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder="Unesite naziv vrta..."
                                required
                                disabled={renameGarden.isPending}
                            />
                            <Typography level="body3">
                                Ovo ime će biti prikazano i drugim korisnicima
                                aplikacije Gredice.
                            </Typography>
                        </Stack>
                        <CardActions className="justify-between">
                            {createdAtDisplay ? (
                                <Typography level="body2">
                                    Kreiran: {createdAtDisplay}
                                </Typography>
                            ) : (
                                <span />
                            )}
                            <Button
                                size="sm"
                                variant="solid"
                                type="submit"
                                loading={renameGarden.isPending}
                                disabled={isRenameDisabled}
                            >
                                Spremi
                            </Button>
                        </CardActions>
                    </Stack>
                </CardContent>
            </form>
        </Card>
    );
}
