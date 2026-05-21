'use client';

import {
    Children,
    type ComponentProps,
    isValidElement,
    type MouseEvent,
    useState,
} from 'react';
import { Card, CardContent, CardHeader } from '../Card';
import { Collapse } from '../Collapse';
import { ExpandDown } from '../icons';
import { Row } from '../Row';
import { cx } from '../utils';

export type AccordionProps = Omit<ComponentProps<typeof Card>, 'variant'> & {
    open?: boolean;
    defaultOpen?: boolean;
    disabled?: boolean;
    onOpenChanged?: (
        event: MouseEvent<HTMLButtonElement>,
        open: boolean,
    ) => void;
    unmountOnExit?: boolean;
    variant?: 'soft' | 'plain';
};

export function Accordion({
    children,
    defaultOpen,
    open,
    disabled,
    onOpenChanged,
    unmountOnExit,
    variant,
    className,
    ...props
}: AccordionProps) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
    const openState = open ?? internalOpen;
    const childrenArray = Children.toArray(children);
    const header = childrenArray[0];
    const content = childrenArray.slice(1).filter(isValidElement);
    const hasSplitContent = content.length > 0;

    function handleToggle(event: MouseEvent<HTMLButtonElement>) {
        if (disabled) {
            return;
        }

        const nextOpen = !openState;
        onOpenChanged?.(event, nextOpen);

        if (open === undefined) {
            setInternalOpen(nextOpen);
        }
    }

    return (
        <Card
            className={cx(
                'p-0',
                variant === 'plain' && 'border-none bg-transparent shadow-none',
                className,
            )}
            {...props}
        >
            <CardHeader className="p-0">
                <button
                    className={cx(
                        'w-full text-left disabled:cursor-not-allowed disabled:opacity-60',
                        variant === 'plain' ? 'px-2 py-4' : 'p-4',
                    )}
                    disabled={disabled}
                    onClick={handleToggle}
                    type="button"
                >
                    <Row spacing={2} justifyContent="space-between">
                        {hasSplitContent && isValidElement(header)
                            ? header
                            : children}
                        {!disabled && (
                            <ExpandDown
                                aria-hidden
                                className={cx(
                                    'size-5 shrink-0 transition-transform',
                                    openState && '-scale-y-100',
                                )}
                            />
                        )}
                    </Row>
                </button>
            </CardHeader>
            {(!unmountOnExit || openState) && (
                <Collapse appear={openState}>
                    {hasSplitContent && (
                        <CardContent
                            className={cx(
                                variant === 'plain'
                                    ? 'px-2 pt-2 pb-4'
                                    : 'p-4 pt-2',
                            )}
                        >
                            {content}
                        </CardContent>
                    )}
                </Collapse>
            )}
        </Card>
    );
}
