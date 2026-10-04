import { Leaf } from '@gredice/ui/icons';

export function AutumnActivityMotifIcon({ kind }: { kind: 'leaf' | 'acorn' }) {
    if (kind === 'leaf') return <Leaf aria-hidden className="size-6" />;
    return (
        <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <path d="M12 3V6M5 11C5 5 19 5 19 11H5ZM7 11V14C7 18 10 20 12 21C14 20 17 18 17 14V11" />
            <path d="M8 8L10 10M11 7L13 10M15 8L16 10" />
        </svg>
    );
}
