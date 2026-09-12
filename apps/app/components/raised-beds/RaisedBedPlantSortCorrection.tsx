'use client';

import type {
    LegacyPlantSortCorrectionIdentity,
    SelectedRaisedBedPlantingTaskCommandIdentity,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Edit } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { correctRaisedBedPlantSortAction } from '../../app/(actions)/raisedBedPlantCorrectionActions';

export function RaisedBedPlantSortCorrection({
    identity,
    options,
    name,
}: {
    identity:
        | LegacyPlantSortCorrectionIdentity
        | SelectedRaisedBedPlantingTaskCommandIdentity;
    options: Array<{ value: string; label: string }>;
    name: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(String(identity.expectedPlantSortId));
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const items = options.some(
        (item) => item.value === String(identity.expectedPlantSortId),
    )
        ? options
        : [
              ...options,
              { value: String(identity.expectedPlantSortId), label: name },
          ];
    return (
        <Popper
            open={open}
            onOpenChange={(next) => {
                if (pending) return;
                if (next) {
                    setValue(String(identity.expectedPlantSortId));
                    setError(null);
                }
                setOpen(next);
            }}
            align="start"
            side="bottom"
            className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-3"
            trigger={
                <Button
                    size="sm"
                    variant="plain"
                    aria-label={`Ispravi biljku ili sortu: ${name}`}
                    title="Ispravi biljku ili sortu"
                    startDecorator={<Edit aria-hidden className="size-4" />}
                >
                    Ispravi sortu
                </Button>
            }
        >
            <p className="text-sm font-medium">Ispravi biljku ili sortu</p>
            <p className="text-xs text-muted-foreground">
                Ispravak zadržava stanje, datume i raspored sadnje.
            </p>
            <SelectItems
                label="Biljka ili sorta"
                items={items}
                value={value}
                onValueChange={setValue}
                searchable
                searchPlaceholder="Pretraži biljke i sorte"
                disabled={pending}
            />
            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button
                    variant="plain"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                >
                    Odustani
                </Button>
                <Button
                    loading={pending}
                    disabled={
                        pending ||
                        !value ||
                        value === String(identity.expectedPlantSortId)
                    }
                    onClick={() => {
                        setError(null);
                        startTransition(async () => {
                            try {
                                await correctRaisedBedPlantSortAction(
                                    identity,
                                    Number(value),
                                    crypto.randomUUID(),
                                );
                                router.refresh();
                                setOpen(false);
                            } catch (error) {
                                setError(
                                    error instanceof Error
                                        ? error.message
                                        : 'Ispravak sorte nije uspio.',
                                );
                            }
                        });
                    }}
                >
                    Spremi ispravak
                </Button>
            </div>
        </Popper>
    );
}
