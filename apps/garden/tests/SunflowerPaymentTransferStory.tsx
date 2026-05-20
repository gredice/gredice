import { useState } from 'react';
import { ButtonPricePickPaymentMethod } from '../../../packages/game/src/hud/components/shopping-cart/ButtonPricePickPaymentMethod';

export function SunflowerPaymentTransferStory({
    initialIsSunflower = false,
}: {
    initialIsSunflower?: boolean;
}) {
    const [isSunflower, setIsSunflower] = useState(initialIsSunflower);

    return (
        <div className="min-h-96 p-12">
            <button
                type="button"
                data-sunflowers-hud-target
                aria-label="Suncokreti"
                className="fixed right-6 top-6 rounded-full border px-4 py-2"
            >
                8.000 🌻
            </button>
            <div className="mt-48 w-fit">
                <ButtonPricePickPaymentMethod
                    price={2.5}
                    isSunflower={isSunflower}
                    onChange={setIsSunflower}
                    availableSunflowers={8000}
                />
            </div>
        </div>
    );
}
