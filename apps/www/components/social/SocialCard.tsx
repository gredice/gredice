import { Card } from '@gredice/ui/Card';
import { Navigate } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

export type SocialCardProps = {
    href: string;
    ctaText: string;
    icon: ReactNode;
    bgColor: string;
    bgIconColor: string;
    navigateIconColor: string;
};

export function SocialCard({
    href,
    ctaText,
    icon,
    bgColor,
    bgIconColor,
    navigateIconColor,
}: SocialCardProps) {
    return (
        <a
            className="group block w-full max-w-md rounded-xl ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
        >
            <Card
                className={cx(
                    'grid min-h-20 w-full grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-xl p-3 shadow transition-shadow duration-300 group-hover:shadow-xl',
                    bgColor,
                )}
            >
                <div
                    aria-hidden="true"
                    className={cx(
                        'grid size-14 place-items-center justify-self-center rounded-full shadow-lg',
                        bgIconColor,
                    )}
                >
                    {icon}
                </div>
                <span className="text-center text-base leading-snug font-bold text-current sm:text-lg">
                    {ctaText}
                </span>
                <Navigate
                    aria-hidden="true"
                    className={cx(
                        'size-7 justify-self-center transition-transform duration-300 group-hover:translate-x-0.5',
                        navigateIconColor,
                    )}
                />
            </Card>
        </a>
    );
}
