import { ExternalLink } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import Link from 'next/link';
import { InventoryQuantityValue } from '../../../../../components/shared/inventory/InventoryQuantityValue';
import { KnownPages } from '../../../../../src/KnownPages';
import { EntityDetailsPanelCard } from './EntityDetailsPanelCard';

type EntityInventoryCardProps = {
    inventoryConfigId: number;
    inventoryLowCountThreshold: number | null;
    entityInventoryItem?: {
        id: number;
        quantity: number;
        lowCountThreshold: number | null;
        notes?: string | null;
    } | null;
    upsertInventoryAction: (formData: FormData) => Promise<void>;
};

export function EntityInventoryCard({
    inventoryConfigId,
    inventoryLowCountThreshold,
    entityInventoryItem,
    upsertInventoryAction,
}: EntityInventoryCardProps) {
    const inventoryHref = entityInventoryItem
        ? KnownPages.InventoryItem(inventoryConfigId, entityInventoryItem.id)
        : KnownPages.InventoryConfig(inventoryConfigId);
    const inventoryAction = (
        <Link href={inventoryHref}>
            <IconButton
                variant="plain"
                title={
                    entityInventoryItem
                        ? 'Otvori stavku zalihe'
                        : 'Otvori stranicu zalihe'
                }
            >
                <ExternalLink className="size-4" />
            </IconButton>
        </Link>
    );

    return (
        <EntityDetailsPanelCard title="Zaliha" action={inventoryAction}>
            <form action={upsertInventoryAction} className="p-4 pt-3">
                <Row spacing={2} className="items-end flex-wrap">
                    <Input
                        name="quantity"
                        label="Količina"
                        type="number"
                        min={0}
                        defaultValue={String(
                            entityInventoryItem?.quantity ?? 0,
                        )}
                    />
                    <div className="pb-2">
                        <InventoryQuantityValue
                            quantity={entityInventoryItem?.quantity ?? 0}
                            lowCountThreshold={
                                entityInventoryItem?.lowCountThreshold ??
                                inventoryLowCountThreshold
                            }
                        />
                    </div>
                    <Input
                        name="notes"
                        label="Bilješka"
                        defaultValue={entityInventoryItem?.notes ?? ''}
                    />
                    <Button type="submit" variant="solid" className="w-fit">
                        {entityInventoryItem
                            ? 'Ažuriraj zalihu'
                            : 'Dodaj u zalihu'}
                    </Button>
                </Row>
            </form>
        </EntityDetailsPanelCard>
    );
}
