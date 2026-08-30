'use client';

import { cx } from '@gredice/ui/utils';
import {
    type KeyboardEvent as ReactKeyboardEvent,
    useEffect,
    useId,
    useRef,
} from 'react';

export const gardenStructureBuildModeControlClassName =
    'pointer-events-auto min-h-11 min-w-11 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-45';

export function GardenStructureConfirmationDialog({
    cancelDisabled = false,
    cancelLabel,
    confirmDisabled = false,
    confirmLabel,
    description,
    destructive = false,
    destructiveAction,
    error,
    onCancel,
    onConfirm,
    testId,
    title,
}: {
    cancelDisabled?: boolean;
    cancelLabel: string;
    confirmDisabled?: boolean;
    confirmLabel: string;
    description: string;
    destructive?: boolean;
    destructiveAction?: Readonly<{
        disabled?: boolean;
        label: string;
        onClick: () => void;
    }>;
    error?: string | null;
    onCancel: () => void;
    onConfirm: () => void;
    testId: string;
    title: string;
}) {
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const descriptionId = useId();
    const titleId = useId();

    useEffect(() => {
        const timeout = window.setTimeout(
            () => cancelButtonRef.current?.focus({ preventScroll: true }),
            0,
        );
        return () => window.clearTimeout(timeout);
    }, []);

    function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
        if (event.key !== 'Tab') {
            return;
        }
        const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLButtonElement>(
                'button:not(:disabled)',
            ) ?? [],
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) {
            return;
        }
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    return (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <div
                aria-describedby={descriptionId}
                aria-labelledby={titleId}
                aria-modal="true"
                className={cx(
                    'w-full max-w-md rounded-2xl border bg-background p-4 text-foreground shadow-2xl',
                    destructive
                        ? 'border-destructive/60'
                        : 'border-amber-600/60',
                )}
                data-testid={testId}
                onKeyDown={trapFocus}
                ref={dialogRef}
                role="alertdialog"
            >
                <p className="text-base font-semibold" id={titleId}>
                    {title}
                </p>
                <p
                    className="mt-1 text-sm text-muted-foreground"
                    id={descriptionId}
                >
                    {description}
                </p>
                {error ? (
                    <p
                        className="mt-3 rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                <div
                    className={cx(
                        'mt-4 grid grid-cols-1 gap-2',
                        destructiveAction ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
                    )}
                >
                    <button
                        type="button"
                        className={gardenStructureBuildModeControlClassName}
                        disabled={cancelDisabled}
                        onClick={onCancel}
                        ref={cancelButtonRef}
                    >
                        {cancelLabel}
                    </button>
                    {destructiveAction ? (
                        <button
                            type="button"
                            className={cx(
                                gardenStructureBuildModeControlClassName,
                                'border-destructive bg-destructive text-destructive-foreground',
                            )}
                            disabled={destructiveAction.disabled}
                            onClick={destructiveAction.onClick}
                        >
                            {destructiveAction.label}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className={cx(
                            gardenStructureBuildModeControlClassName,
                            destructive &&
                                'border-destructive bg-destructive text-destructive-foreground',
                        )}
                        disabled={confirmDisabled}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
