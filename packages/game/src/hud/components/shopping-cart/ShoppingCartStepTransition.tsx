import { type ReactNode, useEffect, useState } from 'react';
import styles from './ShoppingCartStepTransition.module.css';

interface ShoppingCartStepTransitionProps {
    children: ReactNode;
    step: 'cart' | 'delivery';
}

interface ShoppingCartStepContentProps extends ShoppingCartStepTransitionProps {
    animate: boolean;
}

function ShoppingCartStepContent({
    animate,
    children,
    step,
}: ShoppingCartStepContentProps) {
    const [shouldAnimate] = useState(animate);
    const direction = step === 'delivery' ? 'forward' : 'backward';

    return (
        <div
            className={shouldAnimate ? styles.step : undefined}
            data-shopping-cart-step={step}
            data-step-direction={direction}
        >
            {children}
        </div>
    );
}

export function ShoppingCartStepTransition({
    children,
    step,
}: ShoppingCartStepTransitionProps) {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    return (
        <ShoppingCartStepContent animate={hasMounted} key={step} step={step}>
            {children}
        </ShoppingCartStepContent>
    );
}
