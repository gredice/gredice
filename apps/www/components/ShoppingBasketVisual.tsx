import Image from 'next/image';

const shoppingBasketVisualSrc = '/assets/shopping-basket/shopping-basket.webp';

export function ShoppingBasketVisual({ className }: { className?: string }) {
    return (
        <Image
            alt=""
            aria-hidden="true"
            className={className}
            height={480}
            src={shoppingBasketVisualSrc}
            width={512}
        />
    );
}
