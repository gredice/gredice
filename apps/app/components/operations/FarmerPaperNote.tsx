import { cx } from '@gredice/ui/utils';

export function FarmerPaperNote({
    children,
    className,
}: {
    children: string;
    className?: string;
}) {
    return (
        <div
            role="note"
            aria-label="Napomena farmera"
            className={cx(
                'relative isolate w-fit max-w-full -rotate-[0.35deg] overflow-hidden rounded-sm border border-[#d8bc75] bg-[#fff8cf] px-4 py-3 pl-5 text-[#4a3a24] shadow-[2px_3px_0_rgba(79,54,23,0.16)]',
                className,
            )}
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_23px,rgba(96,139,168,0.2)_23px,rgba(96,139,168,0.2)_24px)]"
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 w-px bg-[#d98787]/55"
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-2.5 w-16 -translate-x-1/2 -rotate-2 bg-[#d9be78]/80 shadow-sm"
            />
            <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 right-0 size-0 border-b-[12px] border-l-[12px] border-b-[#e8d89d] border-l-transparent drop-shadow-[-1px_-1px_0_rgba(79,54,23,0.12)]"
            />
            <p
                className="relative line-clamp-4 whitespace-pre-wrap break-words text-[0.95rem] leading-6"
                style={{
                    fontFamily:
                        '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
                }}
            >
                {children}
            </p>
        </div>
    );
}
