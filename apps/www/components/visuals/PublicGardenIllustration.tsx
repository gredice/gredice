import { cx } from '@gredice/ui/utils';
import Image, { type ImageProps } from 'next/image';
import delivery from '../../assets/DeliveryTruck.webp';
import newsletter from '../../assets/NewsletterVisual.webp';
import care from '../../assets/RaisedBedMaintenance.webp';
import sowing from '../../assets/SeedsAndTransplants.webp';

const illustrations = { delivery, care, sowing, newsletter };

/** Decorative artwork beside a visible page or section heading. */
export function PublicGardenIllustration({
    kind,
    size = 192,
    loading = 'lazy',
    className,
}: {
    kind: keyof typeof illustrations;
    size?: number;
    loading?: ImageProps['loading'];
    className?: string;
}) {
    return (
        <Image
            src={illustrations[kind]}
            alt=""
            width={size}
            height={size}
            loading={loading}
            className={cx('shrink-0 object-contain', className)}
        />
    );
}
