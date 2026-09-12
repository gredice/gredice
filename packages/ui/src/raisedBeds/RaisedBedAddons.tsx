import type { RaisedBedAddon } from '@gredice/js/operations';
import { Button } from '../Button';
import { Fence, Layers, Shield, Sprout } from '../icons';
import { Popper } from '../Popper';

const addonPresentation = {
    mulch: { label: 'Malč', icon: Sprout },
    supports: { label: 'Potporanj', icon: Fence },
    agrotextile: { label: 'Agrotekstil', icon: Layers },
    insectMesh: { label: 'Mreža protiv kukaca', icon: Shield },
};

export function RaisedBedAddons({
    addons,
    position,
    fieldCount,
}: {
    addons: RaisedBedAddon[];
    position?: number;
    fieldCount?: number;
}) {
    const visible = addons.filter((addon) =>
        position === undefined
            ? addon.scope === 'raisedBed'
            : addon.positionNumbers.includes(position),
    );
    if (!visible.length) return null;

    return (
        <section
            aria-label={
                position === undefined
                    ? 'Dodaci gredice'
                    : `Dodaci na polju ${position}`
            }
            className="flex min-w-0 flex-wrap gap-1"
        >
            {visible.map((addon) => {
                const { icon: Icon, label } = addonPresentation[addon.family];
                const scope =
                    addon.scope === 'raisedBed' &&
                    addon.positionNumbers.length === fieldCount
                        ? 'Cijela gredica'
                        : `${addon.positionNumbers.length === 1 ? 'Polje' : 'Polja'} ${addon.positionNumbers.join(', ')}`;
                const date = new Intl.DateTimeFormat('hr-HR', {
                    timeZone: 'Europe/Zagreb',
                }).format(new Date(addon.appliedAt));
                return (
                    <Popper
                        key={addon.operationId}
                        align="start"
                        className="max-w-72 space-y-1 p-3 text-sm"
                        trigger={
                            <Button
                                size="sm"
                                variant="plain"
                                className={
                                    addon.pendingVerification
                                        ? 'h-auto min-h-6 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-900'
                                        : 'h-auto min-h-6 px-1.5 py-0.5 text-xs bg-muted'
                                }
                                startDecorator={
                                    <Icon className="size-3.5" aria-hidden />
                                }
                                aria-label={`${label} · ${position === undefined ? scope : `Polje ${position}`}`}
                            >
                                {position === undefined
                                    ? `${label} · ${scope}`
                                    : label}
                            </Button>
                        }
                    >
                        <p className="font-medium">{addon.label}</p>
                        <p>{scope}</p>
                        <p className="text-muted-foreground">
                            Primijenjeno: {date}
                        </p>
                        {addon.pendingVerification && (
                            <p className="text-amber-700">Čeka provjeru</p>
                        )}
                    </Popper>
                );
            })}
        </section>
    );
}
