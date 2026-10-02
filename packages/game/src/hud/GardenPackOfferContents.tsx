import type { BlockData, GardenPackCatalogueOffer } from '@gredice/client';
import { type EntityName, entityNameMap } from '../entities/entityNameMap';
import { EntityItem } from './ItemsHud';
import { getOwnedPackVariantLabel } from './ownedGardenPackInventory';

function isEntityName(name: string): name is EntityName {
    return Object.hasOwn(entityNameMap, name);
}
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
                const variant = getOwnedPackVariantLabel({
                    ...line,
                    remainingQuantity: line.quantity,
                    availableUnitOrdinals: [],
                });
                const block = blockData?.find(
                    (entry) =>
                        entry.id.toString() === line.entityId &&
                        entry.information.name === line.modelName,
                );
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
                        {individualItems &&
                            block &&
                            !line.variant &&
                            isEntityName(line.modelName) && (
                                <EntityItem
                                    type="entity"
                                    name={line.modelName}
                                />
                            )}
                    </li>
                );
            })}
        </ul>
    );
}
