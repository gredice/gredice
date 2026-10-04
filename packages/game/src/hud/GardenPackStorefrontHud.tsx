import { Button } from '@gredice/ui/Button';
import { GameGiftIcon } from '@gredice/ui/GameIcons';
import { IconButton } from '@gredice/ui/IconButton';
import { useEffect, useRef, useState } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { useGardenPackCatalogue } from '../hooks/useGardenPackCatalogue';
import { useGardenPackPurchase } from '../hooks/useGardenPackPurchase';
import { GameModal } from '../shared-ui/game-modal';
import { useBackpackOpenParam, useBackpackTabParam } from '../useUrlState';
import { GardenPackOfferCard } from './GardenPackOfferCard';
import { GardenPackPurchaseReview } from './GardenPackPurchaseReview';

export function GardenPackStorefrontHud() {
    const [open, setOpen] = useState(false);
    const catalogue = useGardenPackCatalogue(open);
    const purchase = useGardenPackPurchase();
    const { data: blockData } = useBlockData();
    const [, setInventoryOpen] = useBackpackOpenParam();
    const [, setInventoryTab] = useBackpackTabParam();
    const openedReceipts = useRef(new Set<string>());
    const receiptId = purchase.session?.receipt?.purchaseId;
    useEffect(() => {
        if (!receiptId || openedReceipts.current.has(receiptId)) return;
        openedReceipts.current.add(receiptId);
        setOpen(false);
        void setInventoryTab('gardenPacks');
        void setInventoryOpen(true);
    }, [receiptId, setInventoryOpen, setInventoryTab]);
    if (!catalogue.context.eligible) return null;
    const review =
        purchase.session &&
        (purchase.session.offer ||
            purchase.session.command ||
            purchase.session.receipt);
    return (
        <GameModal
            open={open}
            onOpenChange={setOpen}
            title="Paketi za vrt"
            trigger={
                <IconButton
                    variant="plain"
                    aria-label="Paketi za vrt"
                    title="Paketi za vrt"
                    className="size-10"
                >
                    <GameGiftIcon className="size-8" />
                </IconButton>
            }
        >
            <div className="min-w-0 space-y-4">
                <Button
                    variant="plain"
                    onClick={() => {
                        setOpen(false);
                        void setInventoryTab('gardenPacks');
                        void setInventoryOpen(true);
                    }}
                >
                    Moji paketi
                </Button>
                {review ? (
                    <GardenPackPurchaseReview
                        purchase={purchase}
                        blockData={blockData}
                        refresh={() => {
                            purchase.reset();
                            void catalogue.refetch();
                        }}
                        openInventory={() => {
                            setOpen(false);
                            void setInventoryTab('gardenPacks');
                            void setInventoryOpen(true);
                        }}
                    />
                ) : (
                    <>
                        {catalogue.isPending && (
                            <p role="status">Učitavanje ponude paketa…</p>
                        )}
                        {catalogue.isError && (
                            <div role="alert">
                                <p>
                                    Ponudu paketa trenutačno nije moguće
                                    učitati.
                                </p>
                                <Button
                                    onClick={() => {
                                        void catalogue.refetch();
                                    }}
                                >
                                    Pokušaj ponovno
                                </Button>
                            </div>
                        )}
                        {catalogue.data &&
                            catalogue.data.offers.length === 0 && (
                                <p>
                                    Trenutačno nema paketa u ponudi. Pojedinačni
                                    predmeti ostaju dostupni u trgovini.
                                </p>
                            )}
                        {catalogue.data?.offers.map((offer) => (
                            <GardenPackOfferCard
                                key={offer.productId}
                                offer={offer}
                                blockData={blockData}
                                onReview={() => purchase.review(offer)}
                            />
                        ))}
                    </>
                )}
            </div>
        </GameModal>
    );
}
