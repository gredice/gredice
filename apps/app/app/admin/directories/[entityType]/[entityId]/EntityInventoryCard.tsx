import { ExternalLink } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import Link from 'next/link';
import { InventoryQuantityValue } from '../../../../../components/shared/inventory/InventoryQuantityValue';
import { KnownPages } from '../../../../../src/KnownPages';

type EntityInventoryCardProps = {
    inventoryConfigId: number;
    inventoryLowCountThreshold: number | null;
    entityInventoryItem?: {
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
    return (
        <Card>
            <CardHeader>
                <Row justifyContent="space-between" className="items-center">
                    <CardTitle>Zaliha</CardTitle>
                    <Link href={KnownPages.InventoryConfig(inventoryConfigId)}>
                        <IconButton
                            variant="plain"
                            title="Otvori stranicu zalihe"
                        >
                            <ExternalLink className="size-4" />
                        </IconButton>
                    </Link>
                </Row>
            </CardHeader>
            <CardContent>
                <form action={upsertInventoryAction}>
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
            </CardContent>
        </Card>
    );
}
