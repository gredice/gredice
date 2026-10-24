import type { BlockData } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import type { useGardenPackPurchase } from '../hooks/useGardenPackPurchase';
import { GardenPackOfferContents } from './GardenPackOfferContents';

export function GardenPackPurchaseReview({
    purchase,
    blockData,
    refresh,
    openInventory,
}: {
    purchase: ReturnType<typeof useGardenPackPurchase>;
    blockData: BlockData[] | null | undefined;
    refresh: () => void;
    openInventory: () => void;
}) {
    const { session } = purchase;
    if (!session || (!session.offer && !session.command && !session.receipt))
        return null;
    const price =
        session.command?.quote.chargedSunflowers ??
        session.offer?.quote.chargedSunflowers ??
        0;
    const shortage = !session.command && purchase.context.balance < price;
    if (session.receipt)
        return (
            <section className="space-y-3" aria-label="Potvrđena kupnja">
                <p role="status">
                    Paket je kupljen. Predmeti su spremljeni u inventar.
                </p>
                <Button onClick={openInventory}>Otvori kupljeni paket</Button>
                <p className="text-sm text-muted-foreground">
                    Novi primjerak kupuje se zasebno i dodaje nove predmete.
                </p>
                <Button variant="plain" onClick={purchase.reset}>
                    Kupiti još jedan primjerak
                </Button>
            </section>
        );
    return (
        <section className="space-y-3 min-w-0" aria-label="Pregled kupnje">
            <h3 className="font-semibold">
                {session.offer?.name.hr ?? 'Kupnja paketa čeka potvrdu'}
            </h3>
            {session.offer && (
                <GardenPackOfferContents
                    offer={session.offer}
                    blockData={blockData}
                />
            )}
            <p>Jedan primjerak: {price} suncokreta</p>
            <p className="text-sm text-muted-foreground">
                Predmeti se spremaju u inventar za kasnije postavljanje. Svaka
                nova kupnja dodaje još jedan primjerak.
            </p>
            <p className="text-sm">
                Stanje: {purchase.context.balance} suncokreta
            </p>
            {shortage && <p role="status">Nedovoljno suncokreta.</p>}
            {session.error && <p role="alert">{session.error}</p>}
            {session.uncertain && (
                <p className="text-sm">
                    Provjera ponavlja isti zahtjev za kupnju; ne pokreće novu
                    kupnju.
                </p>
            )}
            <Button
                disabled={purchase.isPending || shortage}
                onClick={() => {
                    void purchase.confirm();
                }}
            >
                {purchase.isPending
                    ? 'Provjera kupnje…'
                    : session.uncertain
                      ? 'Provjeri kupnju'
                      : session.command
                        ? 'Pokušaj ponovno'
                        : 'Potvrdi kupnju'}
            </Button>
            {!session.uncertain && (
                <Button
                    variant="plain"
                    disabled={purchase.isPending}
                    onClick={refresh}
                >
                    Osvježi ponudu
                </Button>
            )}
        </section>
    );
}
