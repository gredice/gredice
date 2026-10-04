import { CatalogRow } from '../app/cjenik/CatalogRow';
import { PricingHistoryReference } from '../app/cjenik/PricingHistoryReference';
import { formatPrice } from '../lib/formatPrice';

export function PricingDisplayTestStory({
    currentPrice = 5,
    anchorPrice = 5,
    lowestPrice,
}: {
    currentPrice?: number;
    anchorPrice?: number | null;
    lowestPrice?: number;
}) {
    return (
        <div className="mx-8 rounded-lg border p-4">
            <CatalogRow
                currentValue={formatPrice(currentPrice)}
                href="/cjenik"
                historyValue={
                    <PricingHistoryReference
                        currentPrice={currentPrice}
                        history={{
                            lowestPrice: lowestPrice ?? currentPrice,
                            lastChangedAt: null,
                            anchorPrice:
                                anchorPrice === null
                                    ? null
                                    : {
                                          price: anchorPrice,
                                          date: '2026-09-10',
                                      },
                        }}
                    />
                }
                subtitle="Cijena po biljci"
                title="Uzgoj rajčice"
                visual={<span>🌱</span>}
            />
        </div>
    );
}
