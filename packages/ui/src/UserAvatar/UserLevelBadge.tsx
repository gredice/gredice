import { Award, Flower2, Leaf, Sprout } from 'lucide-react';
import { cx } from '../utils';

export function UserLevelBadge({
    level,
    className,
    compact = false,
}: {
    level: number;
    className?: string;
    compact?: boolean;
}) {
    const Icon =
        level >= 7 ? Award : level >= 5 ? Flower2 : level >= 3 ? Leaf : Sprout;
    return (
        <span
            role="img"
            aria-label={`Razina ${level}`}
            title={`Razina ${level}`}
            className={cx(
                'inline-flex shrink-0 items-center justify-center rounded-full border-background font-bold tabular-nums shadow-sm',
                compact
                    ? 'h-3.5 min-w-3.5 border px-0.5 text-[9px] leading-none'
                    : 'gap-0.5 border-2 px-1 py-0.5 text-[10px] leading-none',
                level >= 7
                    ? 'bg-amber-200 text-amber-950'
                    : level >= 5
                      ? 'bg-violet-200 text-violet-950'
                      : level >= 3
                        ? 'bg-emerald-200 text-emerald-950'
                        : 'bg-lime-200 text-lime-950',
                className,
            )}
        >
            {!compact && <Icon aria-hidden className="size-3" />}
            {level}
        </span>
    );
}
