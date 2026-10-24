import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Leaf } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { getLeafRakingTargets } from '../cosmeticLeafRaking/leafRaking';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGameState } from '../useGameState';

export function LeafRakingHud() {
    const { data: garden } = useCurrentGarden();
    const controller = useGameState((state) => state.cosmeticLeafRaking);
    const selected = useGameState((state) => state.closeupBlock);
    const dragging = useGameState((state) =>
        Boolean(
            state.activeDragPreview ||
                state.pickupBlock ||
                state.hudPlacementDrag,
        ),
    );
    const snapshot = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
    );
    const [targetId, setTargetId] = useState('');
    const [sound, setSound] = useState(false);
    const [error, setError] = useState(false);
    const labelId = useId();
    const targets = getLeafRakingTargets(garden?.stacks ?? []);
    const currentTarget =
        targets.find((target) => target.id === targetId) ?? targets[0];
    useEffect(() => {
        if (
            selected &&
            getLeafRakingTargets(garden?.stacks ?? []).some(
                (target) => target.id === selected.id,
            )
        )
            setTargetId(selected.id);
        setError(false);
    }, [selected, garden]);
    if (!currentTarget) return null;
    return (
        <Popper
            side="top"
            sideOffset={12}
            trigger={
                <IconButton
                    variant="plain"
                    aria-label="Ukrasno jesensko lišće"
                    title="Ukrasno jesensko lišće"
                    className="pointer-events-auto size-10"
                >
                    <Leaf className="size-5" />
                </IconButton>
            }
        >
            <section
                aria-label="Ukrasno jesensko lišće"
                className="pointer-events-auto w-56 max-w-[calc(100vw-1rem)] space-y-2 rounded-lg border bg-background/95 p-3 text-sm"
            >
                <label htmlFor={labelId} className="block font-medium">
                    Ukrasno jesensko lišće
                </label>
                <select
                    id={labelId}
                    value={currentTarget.id}
                    onChange={(event) => {
                        setTargetId(event.target.value);
                        setError(false);
                    }}
                    className="w-full rounded border bg-background p-2"
                    disabled={Boolean(snapshot.action)}
                >
                    {targets.map((target, index) => (
                        <option key={target.id} value={target.id}>
                            {target.name === 'LeafRake'
                                ? 'Grablje'
                                : 'Hrpa lišća'}{' '}
                            · {index + 1}
                        </option>
                    ))}
                </select>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={sound}
                        onChange={(event) => setSound(event.target.checked)}
                    />
                    Šuškanje
                </label>
                <Button
                    className="w-full"
                    disabled={
                        !snapshot.available ||
                        dragging ||
                        Boolean(snapshot.action)
                    }
                    onClick={() =>
                        setError(!controller.request(currentTarget.id, sound))
                    }
                >
                    Razgrni lišće
                </Button>
                <p role="status" className="min-h-10 text-muted-foreground">
                    {error
                        ? 'Predmet se još učitava. Pokušaj ponovno.'
                        : snapshot.action
                          ? 'Kratki predah prije novog razgrtanja…'
                          : snapshot.lastTargetId
                            ? 'Ukrasno lišće je razgrnuto.'
                            : 'Samo ukrasni trenutak, bez radova u vrtu i nagrada.'}
                </p>
            </section>
        </Popper>
    );
}
