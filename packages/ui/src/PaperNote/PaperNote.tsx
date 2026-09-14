import type { ComponentPropsWithoutRef } from 'react';
import { cx } from '../utils';

const tapePlacements = [
    { angle: -8, left: '38%', width: 62, top: -6 },
    { angle: 6, left: '63%', width: 68, top: -5 },
    { angle: -4, left: '54%', width: 58, top: -7 },
    { angle: 9, left: '42%', width: 64, top: -5 },
    { angle: -6, left: '66%', width: 60, top: -6 },
    { angle: 3, left: '47%', width: 70, top: -7 },
];

export function PaperNote({
    children,
    className,
    noteKey,
    preview = false,
    ...rest
}: ComponentPropsWithoutRef<'div'> & {
    noteKey: string | number;
    preview?: boolean;
}) {
    // Stable per record, including server rendering and subsequent refetches.
    const hash = Array.from(String(noteKey)).reduce(
        (value, character) =>
            (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0,
        0,
    );
    const tape = tapePlacements[hash % tapePlacements.length];

    return (
        <div
            role="note"
            aria-label="Napomena farmera"
            className={cx(
                'relative isolate mt-2 w-fit min-w-0 max-w-full rounded-sm border border-[#d8bc75] bg-[#fff8cf] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,rgba(96,139,168,0.2)_23px,rgba(96,139,168,0.2)_24px)] px-4 py-3 pl-5 text-[#4a3a24] shadow-[2px_3px_0_rgba(79,54,23,0.16)]',
                className,
            )}
            {...rest}
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 w-px bg-[#d98787]/55"
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute h-3.5 bg-[#d9be78]/70"
                style={{
                    left: tape.left,
                    top: tape.top,
                    width: `min(${tape.width}px, 70%)`,
                    transform: `translateX(-50%) rotate(${tape.angle}deg)`,
                    clipPath:
                        'polygon(2% 0, 98% 3%, 96% 22%, 100% 43%, 97% 63%, 99% 100%, 1% 96%, 3% 73%, 0 48%, 3% 22%)',
                }}
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 right-0 size-0 border-b-[12px] border-l-[12px] border-b-[#e8d89d] border-l-transparent drop-shadow-[-1px_-1px_0_rgba(79,54,23,0.12)]"
            />
            <div
                className={cx(
                    'relative whitespace-pre-wrap text-[0.95rem] leading-6 [overflow-wrap:anywhere]',
                    preview && 'line-clamp-4',
                )}
                style={{
                    fontFamily:
                        '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
                }}
            >
                {children}
            </div>
        </div>
    );
}
