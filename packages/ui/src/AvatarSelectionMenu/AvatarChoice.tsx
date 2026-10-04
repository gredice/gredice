import { Check } from 'lucide-react';
import { Avatar } from '../Avatar';
import { cx } from '../utils';

export function AvatarChoice({
    label,
    avatarUrl,
    selected,
    onSelect,
}: {
    label: string;
    avatarUrl: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cx(
                'relative flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-xl border p-2 text-center transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                selected
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent',
            )}
        >
            <Avatar
                aria-hidden
                src={avatarUrl}
                alt=""
                size="lg"
                className="size-16"
            />
            <span className="min-h-8 text-xs font-medium leading-4">
                {label}
            </span>
            {selected && (
                <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                    <Check aria-hidden className="size-3" />
                </span>
            )}
        </button>
    );
}
