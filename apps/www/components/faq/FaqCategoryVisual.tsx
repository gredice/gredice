'use client';

import {
    GameDeliveryIcon,
    GameInformationIcon,
    GameProfileIcon,
    GameSunflowerIcon,
} from '@gredice/ui/GameIcons';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { useState } from 'react';
import { resolveFaqCategoryImage } from './faqCategoryArtwork';

/** Decorative artwork beside a visible heading; reusable at icon and illustration sizes. */
export function FaqCategoryVisual({
    category,
    size = 64,
    className,
}: {
    category: Parameters<typeof resolveFaqCategoryImage>[0];
    size?: number;
    className?: string;
}) {
    const src = resolveFaqCategoryImage(category);
    const [failedSrc, setFailedSrc] = useState<string>();
    const classes = cx('shrink-0 object-contain', className);

    if (!src || src === failedSrc) {
        const Icon =
            category.information?.name === 'delivery'
                ? GameDeliveryIcon
                : category.information?.name === 'pricing'
                  ? GameSunflowerIcon
                  : category.information?.name === 'account'
                    ? GameProfileIcon
                    : GameInformationIcon;
        return (
            <Icon aria-hidden width={size} height={size} className={classes} />
        );
    }

    return (
        <Image
            src={src}
            alt=""
            width={size}
            height={size}
            className={classes}
            unoptimized
            onError={() => setFailedSrc(src)}
        />
    );
}
