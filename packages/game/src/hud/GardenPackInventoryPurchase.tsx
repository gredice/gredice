import type { BlockData } from '@gredice/client';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@gredice/ui/Button';
import { useState } from 'react';
import { GardenPackLayoutInventoryAction } from './GardenPackLayoutInventoryAction';
import {
    type GardenPackInventoryPlacement,
    getOwnedPackLineBlock,
    getOwnedPackNextUnit,
    getOwnedPackStateLabel,
    getOwnedPackVariantLabel,
    type OwnedGardenPack,
} from './ownedGardenPackInventory';

export function GardenPackInventoryPurchase({
    pack,
    blockData,
    placement,
    onPlaced,
    previewLayouts = false,
}: {
    pack: OwnedGardenPack;
    blockData: BlockData[] | null | undefined;
    placement?: GardenPackInventoryPlacement;
    onPlaced: () => void;
    previewLayouts?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    const [placing, setPlacing] = useState(false);
    const name = pack.name.hr ?? Object.values(pack.name)[0] ?? 'Moj paket';
    return (
        <details
            className="border-b pb-3 min-w-0"
            data-owned-pack={pack.purchaseId}
        >
            <summary className="cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-offset-2">
                <span className="font-semibold break-words">{name}</span>
                {' · '}
                <span>
                    {pack.remainingQuantity}/{pack.totalQuantity} preostalo
                </span>
                <span className="block text-sm text-muted-foreground">
                    {getOwnedPackStateLabel(pack)} · Preuzeto{' '}
                    {new Date(pack.purchasedAt).toLocaleDateString('hr-HR')}
                </span>
                <span className="block break-all text-xs text-muted-foreground">
                    Paket {pack.purchaseId.slice(-8)}
                </span>
            </summary>
            <p className="break-all text-xs text-muted-foreground">
                Paket {pack.purchaseId}
            </p>
            <ul
                className="space-y-3 pt-2"
                aria-label={`Sadržaj paketa ${name}`}
            >
                {pack.lines.map((line) => {
                    const block = getOwnedPackLineBlock(line, blockData);
                    const unit = getOwnedPackNextUnit(pack, line);
                    const label = block?.information.label ?? line.modelName;
                    const variant = getOwnedPackVariantLabel(line);
                    return (
                        <li
                            key={line.lineId}
                            className="flex gap-3 items-start min-w-0"
                            data-pack-line={line.lineId}
                        >
                            {block && !line.variant && (
                                <BlockImage
                                    blockName={line.modelName}
                                    alt=""
                                    width={48}
                                    height={48}
                                    className="size-12 shrink-0 object-contain"
                                />
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-medium break-words">
                                    {label}
                                </p>
                                {variant && (
                                    <p className="text-sm break-words">
                                        Izgled: {variant}
                                    </p>
                                )}
                                <p className="text-sm">
                                    {line.remainingQuantity}/{line.quantity}{' '}
                                    preostalo
                                </p>
                                {line.remainingQuantity > 0 && (
                                    <>
                                        {!block && (
                                            <p className="text-sm text-muted-foreground">
                                                Predmet trenutačno nije dostupan
                                                za prikaz. Ostaje u paketu.
                                            </p>
                                        )}
                                        {!unit && (
                                            <p className="text-sm text-muted-foreground">
                                                Osvježi paket prije
                                                postavljanja.
                                            </p>
                                        )}
                                        {block && unit && !placement && (
                                            <p className="text-sm text-muted-foreground">
                                                Postavljanje još nije dostupno.
                                            </p>
                                        )}
                                        <Button
                                            size="sm"
                                            aria-label={`Postavi ${label} iz kupnje ${pack.purchaseId}`}
                                            disabled={
                                                !block ||
                                                !unit ||
                                                !placement ||
                                                placement.isPending ||
                                                placing
                                            }
                                            onClick={async () => {
                                                if (
                                                    !placement ||
                                                    !unit ||
                                                    !block ||
                                                    placing
                                                )
                                                    return;
                                                setFailed(false);
                                                setPlacing(true);
                                                try {
                                                    await placement.place(unit);
                                                    onPlaced();
                                                } catch {
                                                    setFailed(true);
                                                } finally {
                                                    setPlacing(false);
                                                }
                                            }}
                                        >
                                            {placing || placement?.isPending
                                                ? 'Postavljanje…'
                                                : 'Postavi 1 iz paketa'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            {placement && previewLayouts && (
                <GardenPackLayoutInventoryAction
                    pack={pack}
                    blockData={blockData}
                    onPreview={onPlaced}
                />
            )}
            {(failed || placement?.error) && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                    Postavljanje nije potvrđeno. Osvježi paket ili pokušaj
                    ponovno; provjerit ćemo preostalu količinu.
                </p>
            )}
        </details>
    );
}
