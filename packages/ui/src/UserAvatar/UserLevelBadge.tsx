import { Award, Flower2, Leaf, Sprout } from 'lucide-react';
import { cx } from '../utils';

export function UserLevelBadge({
    level,
    className,
}: {
    level: number;
    className?: string;
}) {
    const Icon =
        level >= 7 ? Award : level >= 5 ? Flower2 : level >= 3 ? Leaf : Sprout;
    return (
        <span
            role="img"
            aria-label={`Razina ${level}`}
            title={`Razina ${level}`}
            className={cx(
                'inline-flex shrink-0 items-center justify-center gap-0.5 rounded-full border-2 border-background px-1 py-0.5 text-[10px] font-bold leading-none tabular-nums shadow-sm',
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
            <Icon aria-hidden className="size-3" />
            {level}
        </span>
    );
}
