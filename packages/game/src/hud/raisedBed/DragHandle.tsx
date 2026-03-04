/**
 * Visual-only grip indicator shown on draggable cells.
 * The actual drag interaction is handled by the parent SortableFieldItem wrapper.
 */
export function DragGripIndicator() {
    return (
        <div
            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            aria-hidden="true"
        >
            <div className="rounded-full px-1.5 py-0.5 shadow-sm">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 6"
                    fill="rgba(63, 98, 18, 0.5)"
                    className="w-5 h-2"
                >
                    <title>Povuci</title>
                    <circle cx="5" cy="1" r="1" />
                    <circle cx="10" cy="1" r="1" />
                    <circle cx="15" cy="1" r="1" />
                    <circle cx="5" cy="5" r="1" />
                    <circle cx="10" cy="5" r="1" />
                    <circle cx="15" cy="5" r="1" />
                </svg>
            </div>
        </div>
    );
}
