import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

export function LandingPricingCard({
    title,
    fromPrice,
    price,
    description,
    href,
    linkLabel,
    children,
}: {
    title: string;
    fromPrice?: boolean;
    price: string;
    description: ReactNode;
    href: string;
    linkLabel: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-tertiary border-b-4 bg-background p-6">
            <Typography
                level="h5"
                component="h3"
                className="text-base font-medium"
            >
                {title}
            </Typography>
            <p className="m-0 flex items-baseline gap-2">
                {fromPrice ? (
                    <span className="text-secondary-foreground">od</span>
                ) : null}
                <span className="font-[family-name:var(--font-montserrat)] text-4xl font-semibold tabular-nums">
                    {price}
                </span>
            </p>
            <Typography level="body2">{description}</Typography>
            <ul className="mt-1 flex flex-col gap-2.5 border-t pt-4 text-sm">
                {children}
            </ul>
            {/* mt-auto keeps the links on one line across cards of uneven height. */}
            <NavigatingButton
                variant="link"
                color="brand"
                className="mt-auto w-fit pt-2"
                href={href}
            >
                {linkLabel}
            </NavigatingButton>
        </div>
    );
}
