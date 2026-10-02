import type { BlockData, GardenPackCatalogueOffer } from '@gredice/client';
import { EntityItem } from './ItemsHud';
import {
    getOwnedPackLineBlock,
    getOwnedPackVariantLabel,
} from './ownedGardenPackInventory';

export function GardenPackOfferContents({
    offer,
    blockData,
    individualItems = false,
}: {
    offer: GardenPackCatalogueOffer;
    blockData: BlockData[] | null | undefined;
    individualItems?: boolean;
}) {
    return (
        <ul className="space-y-2" aria-label="Točan sadržaj paketa">
            {offer.lines.map((line) => {
                const ownedLine = {
                    ...line,
                    remainingQuantity: line.quantity,
                    availableUnitOrdinals: [],
                };
                const variant = getOwnedPackVariantLabel(ownedLine);
                const block = getOwnedPackLineBlock(ownedLine, blockData);
                return (
                    <li
                        key={line.lineId}
                        className="flex items-center gap-3 min-w-0"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="break-words">
                                {line.quantity} × {line.label}
                            </p>
                            {variant && (
                                <p className="text-sm text-muted-foreground break-words">
                                    Izgled: {variant}
                                </p>
                            )}
                        </div>
                        {individualItems && block && !line.variant && (
                            <EntityItem type="entity" name={line.modelName} />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
