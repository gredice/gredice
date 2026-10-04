'use client';

import {
    Card as BaseCard,
    type CardProps as BaseCardProps,
} from '@gredice/ui/Card';
import { forwardRef } from 'react';

export {
    CardActions,
    CardContent,
    type CardContentProps,
    CardCover,
    CardHeader,
    CardOverflow,
    type CardProps,
    CardTitle,
} from '@gredice/ui/Card';

export const Card = forwardRef<HTMLDivElement, BaseCardProps>(function Card(
    { className, ...props },
    ref,
) {
    return (
        <BaseCard
            ref={ref}
            className={`border-tertiary border-b-4 ${className ?? ''}`}
            {...props}
        />
    );
});
