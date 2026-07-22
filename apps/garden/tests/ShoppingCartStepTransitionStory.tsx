import { useState } from 'react';
import { ShoppingCartStepTransition } from '../../../packages/game/src/hud/components/shopping-cart/ShoppingCartStepTransition';

export function ShoppingCartStepTransitionStory() {
    const [step, setStep] = useState<'cart' | 'delivery'>('cart');
    const [cartUpdateCount, setCartUpdateCount] = useState(0);
    const [proceedCount, setProceedCount] = useState(0);

    return (
        <div className="w-80 p-8">
            <ShoppingCartStepTransition step={step}>
                {step === 'cart' ? (
                    <div>
                        <button
                            type="button"
                            onClick={() =>
                                setCartUpdateCount((count) => count + 1)
                            }
                        >
                            Ažuriraj košaricu
                        </button>
                        <output aria-label="Broj ažuriranja košarice">
                            {cartUpdateCount}
                        </output>
                        <button
                            type="button"
                            onClick={() => setStep('delivery')}
                        >
                            Dostava
                        </button>
                    </div>
                ) : (
                    <div>
                        <button type="button" onClick={() => setStep('cart')}>
                            Natrag
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setProceedCount((count) => count + 1)
                            }
                        >
                            Nastavi
                        </button>
                        <output aria-label="Broj nastavaka">
                            {proceedCount}
                        </output>
                    </div>
                )}
            </ShoppingCartStepTransition>
        </div>
    );
}
