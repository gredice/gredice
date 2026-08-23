import Image from 'next/image';

const outletBrandMarkSrc = '/assets/outlet/seedling-price-tag.webp';

export function OutletBrandMark({ className }: { className?: string }) {
    return (
        <Image
            alt=""
            aria-hidden="true"
            className={className}
            height={468}
            src={outletBrandMarkSrc}
            width={512}
        />
    );
}
