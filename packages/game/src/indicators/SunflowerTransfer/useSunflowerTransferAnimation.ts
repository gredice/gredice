import { useCallback, useEffect, useState } from 'react';

type Point = {
    x: number;
    y: number;
};

export type SunflowerTransferDirection = 'hud-to-payment' | 'payment-to-hud';

type SunflowerTransferOptions = {
    paymentElement: HTMLElement | null;
    direction: SunflowerTransferDirection;
    amount?: number;
};

const HUD_TARGET_SELECTOR = '[data-sunflowers-hud-target]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const activeTransferCleanups = new Set<() => void>();

function getPrefersReducedMotion() {
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    ) {
        return false;
    }

    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
        getPrefersReducedMotion,
    );

    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            typeof window.matchMedia !== 'function'
        ) {
            return;
        }

        const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
        const handleChange = () => {
            setPrefersReducedMotion(mediaQueryList.matches);
        };

        setPrefersReducedMotion(mediaQueryList.matches);
        mediaQueryList.addEventListener('change', handleChange);

        return () => {
            mediaQueryList.removeEventListener('change', handleChange);
        };
    }, []);

    return prefersReducedMotion;
}

function clearActiveTransfers() {
    for (const cleanup of Array.from(activeTransferCleanups)) {
        cleanup();
    }
}

function getElementCenter(element: HTMLElement): Point {
    const rect = element.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
}

function getParticleCount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
        return 3;
    }

    return Math.min(7, Math.max(3, Math.ceil(amount / 1500)));
}

function formatSunflowersCompact(amount: number) {
    return amount.toLocaleString('hr-HR', {
        maximumFractionDigits: 0,
    });
}

function createTransferLayer() {
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-sunflower-transfer-layer', 'true');
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.contain = 'layout style paint';
    document.body.appendChild(layer);
    return layer;
}

function createParticle({
    amount,
    index,
    layer,
    from,
}: {
    amount: number;
    index: number;
    layer: HTMLElement;
    from: Point;
}) {
    const particle = document.createElement('span');
    particle.setAttribute('data-sunflower-transfer-particle', 'true');
    particle.textContent =
        index === 0 && amount > 0
            ? `${formatSunflowersCompact(amount)} 🌻`
            : '🌻';
    particle.style.position = 'absolute';
    particle.style.left = `${from.x}px`;
    particle.style.top = `${from.y}px`;
    particle.style.display = 'inline-flex';
    particle.style.alignItems = 'center';
    particle.style.justifyContent = 'center';
    particle.style.minWidth = index === 0 && amount > 0 ? '2.25rem' : '1.5rem';
    particle.style.height = '1.5rem';
    particle.style.padding = index === 0 && amount > 0 ? '0 0.375rem' : '0';
    particle.style.borderRadius = '9999px';
    particle.style.background =
        index === 0 && amount > 0 ? 'rgba(255, 251, 235, 0.96)' : 'transparent';
    particle.style.border =
        index === 0 && amount > 0 ? '1px solid rgba(217, 119, 6, 0.35)' : '0';
    particle.style.color = '#1f2937';
    particle.style.fontSize = index === 0 && amount > 0 ? '0.75rem' : '1.25rem';
    particle.style.fontWeight = index === 0 && amount > 0 ? '700' : '400';
    particle.style.lineHeight = '1';
    particle.style.filter = 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.22))';
    particle.style.transform = 'translate3d(-50%, -50%, 0) scale(0.86)';
    particle.style.willChange = 'transform, opacity';
    layer.appendChild(particle);
    return particle;
}

function animateParticle({
    particle,
    index,
    particleCount,
    from,
    to,
}: {
    particle: HTMLElement;
    index: number;
    particleCount: number;
    from: Point;
    to: Point;
}) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const centeredIndex = index - (particleCount - 1) / 2;
    const spreadX = centeredIndex * 9;
    const spreadY = Math.abs(centeredIndex) * 5;
    const arcY = Math.min(-28, dy * 0.16 - 30);
    const midX = dx * 0.46 + centeredIndex * 14;
    const midY = dy * 0.46 + arcY;
    const duration = 620 + index * 42;
    const delay = index * 34;

    return particle.animate(
        [
            {
                opacity: 0,
                transform:
                    'translate3d(-50%, -50%, 0) translate3d(0, 0, 0) scale(0.82)',
            },
            {
                opacity: 1,
                transform: `translate3d(-50%, -50%, 0) translate3d(${midX}px, ${midY}px, 0) scale(1.1)`,
                offset: 0.4,
            },
            {
                opacity: 0,
                transform: `translate3d(-50%, -50%, 0) translate3d(${dx + spreadX}px, ${dy + spreadY}px, 0) scale(0.5)`,
            },
        ],
        {
            duration,
            delay,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards',
        },
    );
}

function startSunflowerTransfer({
    amount,
    from,
    to,
}: {
    amount: number;
    from: Point;
    to: Point;
}) {
    clearActiveTransfers();

    const layer = createTransferLayer();
    const particleCount = getParticleCount(amount);
    const animations: Animation[] = [];
    let timeoutId: number | undefined;
    let isCleanedUp = false;

    const cleanup = () => {
        if (isCleanedUp) {
            return;
        }

        isCleanedUp = true;

        if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
        }

        for (const animation of animations) {
            animation.cancel();
        }

        layer.remove();
        activeTransferCleanups.delete(cleanup);
    };

    activeTransferCleanups.add(cleanup);

    for (let index = 0; index < particleCount; index += 1) {
        const particle = createParticle({ amount, index, layer, from });
        animations.push(
            animateParticle({
                particle,
                index,
                particleCount,
                from,
                to,
            }),
        );
    }

    const longestDuration = 620 + (particleCount - 1) * 76;
    timeoutId = window.setTimeout(cleanup, longestDuration + 180);

    void Promise.allSettled(
        animations.map((animation) => animation.finished),
    ).then(cleanup);
}

export function animateSunflowerHudToPoint({
    amount = 0,
    to,
}: {
    amount?: number;
    to: Point;
}) {
    if (getPrefersReducedMotion() || typeof document === 'undefined') {
        return;
    }

    const hudElement = document.querySelector<HTMLElement>(HUD_TARGET_SELECTOR);
    if (!hudElement) {
        return;
    }

    startSunflowerTransfer({
        amount,
        from: getElementCenter(hudElement),
        to,
    });
}

export function useSunflowerTransferAnimation() {
    const prefersReducedMotion = usePrefersReducedMotion();

    return useCallback(
        ({
            paymentElement,
            direction,
            amount = 0,
        }: SunflowerTransferOptions) => {
            if (
                prefersReducedMotion ||
                typeof document === 'undefined' ||
                !paymentElement
            ) {
                return;
            }

            const hudElement =
                document.querySelector<HTMLElement>(HUD_TARGET_SELECTOR);
            if (!hudElement) {
                return;
            }

            const sourceElement =
                direction === 'hud-to-payment' ? hudElement : paymentElement;
            const targetElement =
                direction === 'hud-to-payment' ? paymentElement : hudElement;

            startSunflowerTransfer({
                amount,
                from: getElementCenter(sourceElement),
                to: getElementCenter(targetElement),
            });
        },
        [prefersReducedMotion],
    );
}
