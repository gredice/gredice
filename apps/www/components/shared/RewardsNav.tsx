import { Link } from '@gredice/ui/Link';
import { cx } from '@gredice/ui/utils';
import { KnownPages } from '../../src/KnownPages';

const rewardsPages = [
    { key: 'sunflowers', label: 'Suncokreti', href: KnownPages.Sunflowers },
    {
        key: 'achievements',
        label: 'Postignuća',
        href: KnownPages.Achievements,
    },
    { key: 'experience', label: 'XP i razine', href: KnownPages.Experience },
    { key: 'referrals', label: 'Preporuke', href: KnownPages.Referrals },
] as const;

export type RewardsNavPage = (typeof rewardsPages)[number]['key'];

/**
 * Connects the four pages that explain one system: the sunflower balance,
 * achievements, levels and referrals. Placed directly under each page header.
 */
export function RewardsNav({
    current,
    className,
}: {
    current: RewardsNavPage;
    className?: string;
}) {
    return (
        <nav
            aria-label="Nagrade i napredak"
            className={cx(
                // On phones the row scrolls edge to edge through the page
                // gutter instead of clipping at it.
                '-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden',
                className,
            )}
        >
            <ul className="flex min-w-max gap-1 border-b">
                {rewardsPages.map((page) => {
                    const isCurrent = page.key === current;
                    return (
                        <li key={page.key}>
                            <Link
                                href={page.href}
                                aria-current={isCurrent ? 'page' : undefined}
                                className={cx(
                                    '-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                                    isCurrent
                                        ? 'border-brand text-foreground'
                                        : 'border-transparent text-muted-foreground hover:border-tertiary hover:text-foreground',
                                )}
                            >
                                {page.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
