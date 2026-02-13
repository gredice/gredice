import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardActions, CardContent } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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
                            <Typography level="body2">
                                Promijeni ime vrta.
                            </Typography>
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
                                Ovo ime će biti prikazano u Gredici i
                                podijeljeno s drugim igračima kada posjete ovaj
                                vrt.
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
