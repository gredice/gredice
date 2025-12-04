import { PlantOrSortImage } from '@gredice/ui/plants';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { BackpackIcon } from '../icons/Backpack';
import { HudCard } from './components/HudCard';

export function InventoryHud() {
    const { data: inventory } = useInventory();
    const [open, setOpen] = useState(false);

    const totalItems = useMemo(
        () =>
            inventory?.items?.reduce(
                (sum: number, item: { amount: number }) => sum + item.amount,
                0,
            ) ?? 0,
        [inventory?.items],
    );

    return (
        <HudCard open position="floating" className="static p-0.5">
            <Modal
                open={open}
                onOpenChange={setOpen}
                title="Ruksak"
                trigger={
                    <IconButton
                        variant="plain"
                        className="rounded-full size-10"
                        title="Inventar"
                    >
                        <div className="relative flex items-center justify-center">
                            <BackpackIcon className="size-6" />
                            {totalItems > 0 && (
                                <span className="absolute -top-1 -right-1 text-[10px] font-semibold bg-emerald-500 text-white rounded-full px-1">
                                    {totalItems}
                                </span>
                            )}
                        </div>
                    </IconButton>
                }
            >
                <Stack spacing={2}>
                    <Typography level="body2" secondary>
                        Pregled biljaka i radnji spremljenih u ruksak.
                    </Typography>
                    <Stack spacing={1} className="max-h-80 overflow-y-auto pr-1">
                        {inventory?.items?.length ? (
                            inventory.items.map((item: any) => (
                                <Row
                                    key={`${item.entityTypeName}-${item.entityId}`}
                                    spacing={1.5}
                                    alignItems="center"
                                    className="border rounded-lg p-2"
                                >
                                    <PlantOrSortImage
                                        width={40}
                                        height={40}
                                        className="rounded-md border"
                                        coverUrl={item.image}
                                        alt={item.name || item.entityId}
                                        baseUrl="https://www.gredice.com"
                                    />
                                    <Stack className="grow">
                                        <Typography level="body2" semiBold>
                                            {item.name ?? 'Nepoznati predmet'}
                                        </Typography>
                                        <Typography level="body3" secondary>
                                            {item.entityTypeName}
                                        </Typography>
                                    </Stack>
                                    <Typography level="body2" semiBold>
                                        ×{item.amount}
                                    </Typography>
                                </Row>
                            ))
                        ) : (
                            <Typography level="body2" secondary>
                                Još nema spremljenih predmeta.
                            </Typography>
                        )}
                    </Stack>
                </Stack>
            </Modal>
        </HudCard>
    );
}
