import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import delivery from '../../assets/DeliveryTruck.webp';
import care from '../../assets/RaisedBedMaintenance.webp';
import sowing from '../../assets/SeedsAndTransplants.webp';

const illustrations = { delivery, care, sowing };

/** Decorative artwork beside a visible page or section heading. */
export function PublicGardenIllustration({
    kind,
    size = 192,
    className,
}: {
    kind: keyof typeof illustrations;
    size?: number;
    className?: string;
}) {
    return (
        <Image
            src={illustrations[kind]}
            alt=""
            width={size}
            height={size}
            className={cx('shrink-0 object-contain', className)}
        />
    );
}
