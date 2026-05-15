import { cx } from '@signalco/ui-primitives/cx';
import {
    Children,
    type CSSProperties,
    isValidElement,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
    useEffect,
    useRef,
    useState,
} from 'react';

const iconSize = 32;
const iconSpread = 24;
const hoverPadding = 8;
const stackOffsetXStep = 4;
const stackOffsetYStep = 1;

export function RaisedBedFieldIconStack({ children }: { children: ReactNode }) {
    const [isTouchExpanded, setIsTouchExpanded] = useState(false);
    const stackRef = useRef<HTMLFieldSetElement>(null);
    const swallowNextClickRef = useRef(false);
    const swallowClickTimeoutRef = useRef<number | null>(null);
    const items = Children.toArray(children).filter(Boolean);

    useEffect(() => {
        if (!isTouchExpanded) {
            return;
        }

        function handleDocumentPointerDown(event: PointerEvent) {
            if (event.pointerType !== 'touch') {
                return;
            }

            const target = event.target;
            if (target instanceof Node && stackRef.current?.contains(target)) {
                return;
            }

            setIsTouchExpanded(false);
        }

        document.addEventListener(
            'pointerdown',
            handleDocumentPointerDown,
            true,
        );
        return () => {
            document.removeEventListener(
                'pointerdown',
                handleDocumentPointerDown,
                true,
            );
        };
    }, [isTouchExpanded]);

    useEffect(() => {
        return () => {
            if (swallowClickTimeoutRef.current) {
                window.clearTimeout(swallowClickTimeoutRef.current);
            }
        };
    }, []);

    function clearSwallowedClick() {
        swallowNextClickRef.current = false;
        if (swallowClickTimeoutRef.current) {
            window.clearTimeout(swallowClickTimeoutRef.current);
            swallowClickTimeoutRef.current = null;
        }
    }

    // React's event delegation walks the *component* tree, so capture-phase
    // handlers on the fieldset also fire for events on React children that
    // were rendered through portals (for example, the vaul drawer overlay
    // attached to a stacked-plant modal). If we treat those events as taps
    // inside the stack we will both `setIsTouchExpanded(true)` again and call
    // `event.stopPropagation()`, which prevents Radix's document-level
    // pointerdown listener from firing — so backdrop-tap-to-dismiss and
    // swipe-down dismissal of the opened drawer silently break. Guard every
    // capture-phase handler with a DOM `contains` check.
    function isEventInsideStack(
        event:
            | ReactPointerEvent<HTMLFieldSetElement>
            | ReactMouseEvent<HTMLFieldSetElement>,
    ) {
        const target = event.target;
        return (
            target instanceof Node &&
            stackRef.current !== null &&
            stackRef.current.contains(target)
        );
    }

    function handlePointerDownCapture(
        event: ReactPointerEvent<HTMLFieldSetElement>,
    ) {
        if (
            items.length < 2 ||
            event.pointerType !== 'touch' ||
            isTouchExpanded ||
            !isEventInsideStack(event)
        ) {
            return;
        }

        setIsTouchExpanded(true);
        swallowNextClickRef.current = true;
        if (swallowClickTimeoutRef.current) {
            window.clearTimeout(swallowClickTimeoutRef.current);
        }
        swallowClickTimeoutRef.current = window.setTimeout(
            clearSwallowedClick,
            700,
        );
        event.stopPropagation();
    }

    function handleClickCapture(event: ReactMouseEvent<HTMLFieldSetElement>) {
        if (!isEventInsideStack(event)) {
            return;
        }

        if (swallowNextClickRef.current) {
            clearSwallowedClick();
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // A click that survived the swallow guard is activating a child icon
        // (typically opening a modal/drawer). Collapse the stack now so the
        // document-level pointerdown listener detaches before the child's
        // drawer starts handling swipe-to-dismiss and backdrop-tap gestures.
        if (isTouchExpanded) {
            setIsTouchExpanded(false);
        }
    }

    if (items.length === 0) {
        return null;
    }

    const maxSpread = (items.length - 1) * iconSpread;
    const maxStackOffsetY = (items.length - 1) * stackOffsetYStep;
    const expandedWidth = iconSize + maxSpread + hoverPadding;
    const expandedHeight = iconSize + maxStackOffsetY + hoverPadding;

    return (
        <fieldset
            ref={stackRef}
            aria-label="Pokazatelji polja"
            className="group absolute -right-1.5 -top-1.5 z-20 m-0 min-w-0 border-0 p-0"
            data-field-icon-stack
            data-touch-expanded={isTouchExpanded ? 'true' : 'false'}
            onClickCapture={handleClickCapture}
            onPointerDownCapture={handlePointerDownCapture}
            style={{
                height: `${expandedHeight}px`,
                width: `${expandedWidth}px`,
            }}
        >
            {items.map((item, index) => {
                const spreadIndex = items.length - index - 1;
                const stackOffsetX = spreadIndex * stackOffsetXStep;
                const stackOffsetY = spreadIndex * stackOffsetYStep;
                const spreadOffset = spreadIndex * iconSpread;

                return (
                    <div
                        key={
                            isValidElement(item)
                                ? (item.key ?? String(item))
                                : String(item)
                        }
                        className={cx(
                            'absolute origin-top-right transition-[filter,transform] duration-150 ease-out',
                            'group-hover:translate-x-[calc(var(--field-icon-spread)*-1)]',
                            'group-hover:scale-110 group-hover:drop-shadow-lg',
                            'group-focus-within:translate-x-[calc(var(--field-icon-spread)*-1)]',
                            'group-focus-within:scale-110 group-focus-within:drop-shadow-lg',
                            isTouchExpanded &&
                                'translate-x-[calc(var(--field-icon-spread)*-1)] scale-110 drop-shadow-lg',
                        )}
                        style={
                            {
                                '--field-icon-spread': `${spreadOffset}px`,
                                right: `${stackOffsetX}px`,
                                top: `${stackOffsetY}px`,
                                zIndex: index + 1,
                            } as CSSProperties
                        }
                    >
                        {item}
                    </div>
                );
            })}
        </fieldset>
    );
}
