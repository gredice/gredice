import { Error as ErrorIcon, ExternalLink, Warning } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import Link from 'next/link';
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
    const quantity = entityInventoryItem?.quantity ?? 0;
    const lowCountThreshold =
        entityInventoryItem?.lowCountThreshold ?? inventoryLowCountThreshold;
    const inventoryIsEmpty = quantity === 0;
    const inventoryIsLow =
        !inventoryIsEmpty &&
        lowCountThreshold !== null &&
        quantity <= lowCountThreshold;
    const inventoryActionLabel = entityInventoryItem
        ? 'Otvori stavku zalihe'
        : 'Otvori stranicu zalihe';
    const inventoryAction = (
        <Link
            href={inventoryHref}
            title={inventoryActionLabel}
            aria-label={inventoryActionLabel}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <ExternalLink className="size-3.5" aria-hidden />
        </Link>
    );

    return (
        <EntityDetailsPanelCard title="Zaliha" action={inventoryAction}>
            <form
                action={upsertInventoryAction}
                className="space-y-3 px-4 pt-2"
            >
                <div className="space-y-1.5">
                    <Input
                        name="quantity"
                        label="Količina"
                        type="number"
                        min={0}
                        defaultValue={String(quantity)}
                        fullWidth
                    />
                    {inventoryIsEmpty && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ErrorIcon
                                className="size-3.5 text-red-500"
                                aria-hidden
                            />
                            <span>Nema zalihe</span>
                        </p>
                    )}
                    {inventoryIsLow && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Warning
                                className="size-3.5 text-amber-500"
                                aria-hidden
                            />
                            <span>Niska zaliha</span>
                        </p>
                    )}
                </div>
                <Input
                    name="notes"
                    label="Bilješka"
                    defaultValue={entityInventoryItem?.notes ?? ''}
                    fullWidth
                />
                <Button type="submit" size="sm" fullWidth>
                    {entityInventoryItem ? 'Ažuriraj zalihu' : 'Dodaj u zalihu'}
                </Button>
            </form>
        </EntityDetailsPanelCard>
    );
}
