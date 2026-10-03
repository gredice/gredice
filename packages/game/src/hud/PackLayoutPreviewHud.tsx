import { Button } from '@gredice/ui/Button';
import { useEffect, useRef } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGardenPackLayoutPlacement } from '../hooks/useGardenPackLayoutPlacement';
import { useOwnedPackLayouts } from '../hooks/useOwnedPackLayouts';
import {
    movePackLayout,
    packLayoutGardenSignature,
    turnPackLayout,
} from '../packLayouts/packLayoutPreviewState';
import {
    getPackLayoutQuantities,
    resolveOwnedPackLayout,
} from '../packLayouts/packLayoutProjection';
import { useGameState, useGameStateStore } from '../useGameState';

export function PackLayoutPreviewHud() {
    const selection = useGameState((state) => state.packLayoutPreview);
    const update = useGameState((state) => state.setPackLayoutPreview);
    const locked = useGameState((state) => state.packLayoutPreviewLocked);
    const unavailable = useGameState(
        (state) => state.packLayoutPreviewUnavailable,
    );
    const framed = useGameState((state) => state.packLayoutPreviewFramed);
    const ready = useGameState((state) => state.packLayoutPreviewReady);
    const setReady = useGameState((state) => state.setPackLayoutPreviewReady);
    const flow = useGardenPackLayoutPlacement();
    const layouts = useOwnedPackLayouts(selection?.pack.purchaseId);
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const focus = useRef<HTMLElement>(null);
    const store = useGameStateStore();
    const surfaceKey =
        selection?.key ??
        flow.session?.command?.body.operationId ??
        flow.session?.receipt?.operationId;
    const eligible = flow.context.eligible;
    useEffect(() => {
        const element = focus.current;
        if (!surfaceKey || !eligible || !element) return;
        const measure = () => {
            if (!element.isConnected) return;
            const rect = element.getBoundingClientRect();
            const previous = store.getState().packLayoutPreviewHudRect;
            if (
                previous?.top === rect.top &&
                previous.left === rect.left &&
                previous.right === rect.right &&
                previous.bottom === rect.bottom
            )
                return;
            store.getState().setPackLayoutPreviewHudRect({
                top: rect.top,
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom,
            });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
            store.getState().setPackLayoutPreviewHudRect(null);
        };
    }, [surfaceKey, eligible, store]);
    const previewKey = selection?.key;
    useEffect(() => {
        if (previewKey) focus.current?.focus({ preventScroll: true });
    }, [previewKey]);
    const layout = layouts.data?.layouts.find(
        (item) => item.id === selection?.layoutId,
    );
    const stale =
        selection && garden
            ? selection.gardenSignature !== packLayoutGardenSignature(garden)
            : true;
    const preview =
        selection && garden && layout
            ? resolveOwnedPackLayout({
                  layout,
                  pack: selection.pack,
                  blockData,
                  garden,
                  anchor: selection.anchor,
                  rotation: selection.rotation,
              })
            : null;
    const cancel = () => {
        update(null);
        document
            .querySelector('[data-inventory-trigger-icon]')
            ?.closest<HTMLButtonElement>('button')
            ?.focus();
    };
    const move = (x: number, y: number) => {
        if (selection && !locked) {
            setReady(false);
            update(movePackLayout(selection, x, y));
        }
    };
    if (!selection && !flow.session?.command && !flow.session?.receipt)
        return null;
    if (!flow.context.eligible) return null;
    return (
        <section
            ref={focus}
            tabIndex={-1}
            aria-label="Pregled rasporeda iz paketa"
            data-pack-layout-surface="true"
            className="pointer-events-auto absolute bottom-16 left-1/2 z-30 w-80 max-w-[calc(100vw-1rem)] -translate-x-1/2 space-y-2 rounded-xl border bg-background/95 p-3 shadow-lg text-sm max-h-[45vh] overflow-auto"
            onKeyDown={(event) => {
                if (event.key === 'Escape' && !locked) {
                    event.preventDefault();
                    cancel();
                }
                if (!selection || locked) return;
                const delta =
                    event.key === 'ArrowLeft'
                        ? [-1, 0]
                        : event.key === 'ArrowRight'
                          ? [1, 0]
                          : event.key === 'ArrowUp'
                            ? [0, -1]
                            : event.key === 'ArrowDown'
                              ? [0, 1]
                              : null;
                if (delta) {
                    event.preventDefault();
                    move(delta[0] ?? 0, delta[1] ?? 0);
                }
                if (event.key.toLowerCase() === 'r') {
                    event.preventDefault();
                    setReady(false);
                    update(turnPackLayout(selection));
                }
            }}
        >
            <p className="font-semibold">
                {layout?.name.hr ?? 'Raspored iz kupljenog paketa'}
            </p>
            <p>
                Već plaćeno · bez dodatne naplate. Predmeti nakon postavljanja
                ostaju zasebno uređivi.
            </p>
            {layout && (
                <details>
                    <summary className="cursor-pointer">
                        {getPackLayoutQuantities(layout).reduce(
                            (total, item) => total + item.quantity,
                            0,
                        )}{' '}
                        potrebno ·{' '}
                        {getPackLayoutQuantities(layout).reduce(
                            (total, item) => total + item.available,
                            0,
                        )}{' '}
                        dostupno · predmeti
                    </summary>
                    <ul aria-label="Potrebni i dostupni predmeti">
                        {getPackLayoutQuantities(layout).map((item) => (
                            <li key={item.lineId}>
                                {blockData?.find(
                                    (block) =>
                                        block.id.toString() ===
                                        selection?.pack.lines.find(
                                            (line) =>
                                                line.lineId === item.lineId,
                                        )?.entityId,
                                )?.information.label ?? 'Predmet iz paketa'}
                                : {item.quantity} potrebno · {item.available}{' '}
                                dostupno
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            {selection && !flow.session?.command && (
                <>
                    <p>
                        Mjesto: {selection.anchor.x}, {selection.anchor.y} ·
                        zakret: {selection.rotation * 90}°
                    </p>
                    <fieldset
                        className="grid grid-cols-3 gap-1"
                        aria-label="Pomicanje i zakret rasporeda"
                    >
                        <Button
                            size="sm"
                            disabled={locked}
                            onClick={() => move(-1, 0)}
                            aria-label="Pomakni lijevo"
                        >
                            ←
                        </Button>
                        <Button
                            size="sm"
                            disabled={locked}
                            onClick={() => move(0, -1)}
                            aria-label="Pomakni naprijed"
                        >
                            ↑
                        </Button>
                        <Button
                            size="sm"
                            disabled={locked}
                            onClick={() => {
                                setReady(false);
                                update(turnPackLayout(selection));
                            }}
                        >
                            Zakreni 90°
                        </Button>
                        <Button
                            size="sm"
                            disabled={locked}
                            onClick={() => move(1, 0)}
                            aria-label="Pomakni desno"
                        >
                            →
                        </Button>
                        <Button
                            size="sm"
                            disabled={locked}
                            onClick={() => move(0, 1)}
                            aria-label="Pomakni natrag"
                        >
                            ↓
                        </Button>
                        <Button size="sm" disabled={locked} onClick={cancel}>
                            Odustani
                        </Button>
                    </fieldset>
                    <p role="status">
                        {unavailable
                            ? 'Model se nije učitao. Osvježi stranicu pa ponovno otvori pregled.'
                            : stale
                              ? 'Vrt se promijenio. Otvori novi pregled prije postavljanja.'
                              : (preview?.error ??
                                (preview?.valid
                                    ? 'Raspored stane na odabrano mjesto.'
                                    : 'Učitavanje rasporeda…'))}
                    </p>
                </>
            )}
            {flow.session?.error && (
                <p role="alert" className="text-destructive">
                    {flow.session.error}
                </p>
            )}
            {flow.session?.receipt ? (
                <>
                    <p role="status">
                        Postavljeno {flow.session.receipt.placements.length}{' '}
                        predmeta · dodatno naplaćeno 0.
                    </p>
                    <Button
                        size="sm"
                        onClick={() => {
                            flow.dismiss();
                            update(null);
                        }}
                    >
                        Zatvori
                    </Button>
                </>
            ) : (
                <Button
                    className="w-full"
                    disabled={
                        flow.session?.pending ||
                        (!flow.session?.command &&
                            (!preview?.valid ||
                                stale ||
                                unavailable ||
                                !layout ||
                                !ready ||
                                !framed))
                    }
                    onClick={() => void flow.confirm(layout, blockData)}
                >
                    {flow.session?.pending
                        ? 'Provjera postavljanja…'
                        : flow.session?.command
                          ? 'Provjeri isti zahtjev'
                          : 'Potvrdi postavljanje'}
                </Button>
            )}
        </section>
    );
}
