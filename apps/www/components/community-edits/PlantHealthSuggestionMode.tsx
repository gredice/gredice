import { cx } from '@gredice/ui/utils';
import { useId } from 'react';

const modes: ('existing' | 'new')[] = ['existing', 'new'];

export function PlantHealthSuggestionMode({
    kind,
    value,
    onChange,
}: {
    kind: 'disease' | 'pest';
    value: 'existing' | 'new';
    onChange: (value: 'existing' | 'new') => void;
}) {
    const id = useId();
    return (
        <fieldset className="grid grid-cols-2 gap-1 rounded-md border border-border/80 bg-card p-1 shadow-sm">
            <legend className="sr-only">Vrsta prijedloga</legend>
            {modes.map((mode) => (
                <label
                    key={mode}
                    className={cx(
                        'relative flex min-h-11 cursor-pointer items-center justify-center rounded-sm px-3 text-center text-sm font-medium focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                        value === mode
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted',
                    )}
                >
                    <input
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                        type="radio"
                        name={`${id}-mode`}
                        checked={value === mode}
                        onChange={() => onChange(mode)}
                        value={mode}
                    />
                    {mode === 'existing'
                        ? 'Odaberi postojeće'
                        : kind === 'disease'
                          ? 'Predloži novu bolest'
                          : 'Predloži novog štetnika'}
                </label>
            ))}
        </fieldset>
    );
}
