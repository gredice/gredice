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
import { KnownPages } from '../../../../../src/KnownPages';

type EntityInventoryCardProps = {
    inventoryConfigId: number;
    entityInventoryItem?: { quantity: number; notes?: string | null } | null;
    upsertInventoryAction: (formData: FormData) => Promise<void>;
};

export function EntityInventoryCard({
    inventoryConfigId,
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
