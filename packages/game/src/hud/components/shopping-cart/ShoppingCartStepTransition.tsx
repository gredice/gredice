import { type ReactNode, useEffect, useRef, useState } from 'react';
import styles from './ShoppingCartStepTransition.module.css';

interface ShoppingCartStepTransitionProps {
    children: ReactNode;
    direction?: 'forward' | 'backward';
    step: 'cart' | 'delivery' | 'harvest';
}

interface ShoppingCartStepContentProps extends ShoppingCartStepTransitionProps {
    animate: boolean;
}

function ShoppingCartStepContent({
    animate,
    children,
    direction,
    step,
}: ShoppingCartStepContentProps) {
    const [shouldAnimate] = useState(animate);
    const contentRef = useRef<HTMLElement>(null);
    const resolvedDirection =
        direction ?? (step === 'cart' ? 'backward' : 'forward');
    const accessibleStepLabel =
        step === 'cart'
            ? 'Košarica'
            : step === 'delivery'
              ? 'Dostava'
              : 'Branje';

    useEffect(() => {
        if (step === 'harvest') {
            contentRef.current?.focus();
        }
    }, [step]);

    return (
        <section
            aria-label={accessibleStepLabel}
            className={shouldAnimate ? styles.step : undefined}
            data-shopping-cart-step={step}
            data-step-direction={resolvedDirection}
            ref={contentRef}
            tabIndex={step === 'harvest' ? -1 : undefined}
        >
            {children}
        </section>
    );
}

export function ShoppingCartStepTransition({
    children,
    direction,
    step,
}: ShoppingCartStepTransitionProps) {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    return (
        <ShoppingCartStepContent
            animate={hasMounted}
            direction={direction}
            key={step}
            step={step}
        >
            {children}
        </ShoppingCartStepContent>
    );
}
