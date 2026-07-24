import { useState } from 'react';
import { ShoppingCartStepTransition } from '../../../packages/game/src/hud/components/shopping-cart/ShoppingCartStepTransition';

export function ShoppingCartStepTransitionStory() {
    const [step, setStep] = useState<'cart' | 'delivery' | 'harvest'>('cart');
    const [direction, setDirection] = useState<'forward' | 'backward'>(
        'forward',
    );
    const [cartUpdateCount, setCartUpdateCount] = useState(0);
    const [proceedCount, setProceedCount] = useState(0);

    return (
        <div className="w-80 p-8">
            <ShoppingCartStepTransition direction={direction} step={step}>
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
                            onClick={() => {
                                setDirection('forward');
                                setStep('delivery');
                            }}
                        >
                            Dostava
                        </button>
                    </div>
                ) : step === 'delivery' ? (
                    <div>
                        <button
                            type="button"
                            onClick={() => {
                                setDirection('backward');
                                setStep('cart');
                            }}
                        >
                            Natrag
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDirection('forward');
                                setStep('harvest');
                            }}
                        >
                            Nastavi
                        </button>
                    </div>
                ) : (
                    <div>
                        <button
                            type="button"
                            onClick={() => {
                                setDirection('backward');
                                setStep('delivery');
                            }}
                        >
                            Natrag na dostavu
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setProceedCount((count) => count + 1)
                            }
                        >
                            Potvrdi datume
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
