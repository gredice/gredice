'use client';

import {
    type ChangeEvent,
    type CSSProperties,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Search } from '../icons';
import { cx } from '../utils';

export type ExpandableSearchInputProps = {
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
};

export function ExpandableSearchInput({
    value,
    onChange,
    placeholder = 'Pretraži...',
    className,
    inputClassName,
}: ExpandableSearchInputProps) {
    const [isExpanded, setIsExpanded] = useState(Boolean(value));
    const [portalElement, setPortalElement] = useState<HTMLElement | null>(
        null,
    );
    const [mobileInputStyle, setMobileInputStyle] =
        useState<CSSProperties | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const mobileInputRootRef = useRef<HTMLDivElement>(null);

    const updateMobileInputPosition = useCallback(() => {
        const rootElement = rootRef.current;
        if (!rootElement) {
            return;
        }

        const rect = rootElement.getBoundingClientRect();
        const viewportPadding = 16;
        const availableWidth = Math.max(
            0,
            window.innerWidth - viewportPadding * 2,
        );
        const inputWidth = Math.min(288, availableWidth);
        const maxRight = window.innerWidth - viewportPadding - inputWidth;
        const anchoredRight = window.innerWidth - rect.right;
        const right = Math.max(
            viewportPadding,
            Math.min(anchoredRight, maxRight),
        );
        const top = Math.max(
            viewportPadding,
            Math.min(rect.bottom + 8, window.innerHeight - 64),
        );

        setMobileInputStyle({
            position: 'fixed',
            right,
            top,
            width: inputWidth,
            zIndex: 50,
        });
    }, []);

    useEffect(() => {
        setPortalElement(document.body);
    }, []);

    useEffect(() => {
        if (isExpanded && (mobileInputStyle || !portalElement)) {
            mobileInputRootRef.current?.querySelector('input')?.focus();
        }
    }, [isExpanded, mobileInputStyle, portalElement]);

    useEffect(() => {
        if (value) {
            setIsExpanded(true);
        }
    }, [value]);

    useEffect(() => {
        if (!isExpanded) {
            setMobileInputStyle(null);
            return;
        }

        updateMobileInputPosition();

        window.addEventListener('resize', updateMobileInputPosition);
        window.addEventListener('scroll', updateMobileInputPosition, true);

        return () => {
            window.removeEventListener('resize', updateMobileInputPosition);
            window.removeEventListener(
                'scroll',
                updateMobileInputPosition,
                true,
            );
        };
    }, [isExpanded, updateMobileInputPosition]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (
                !(target instanceof Node) ||
                (!rootRef.current?.contains(target) &&
                    !mobileInputRootRef.current?.contains(target))
            ) {
                setIsExpanded(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, []);

    return (
        <div ref={rootRef} className={cx('relative', className)}>
            <div className="hidden md:block">
                <Input
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    startDecorator={<Search className="size-5 shrink-0 ml-3" />}
                    className={inputClassName}
                />
            </div>
            <div className="md:hidden">
                <IconButton
                    variant="plain"
                    title="Pretraži"
                    onClick={() => setIsExpanded(true)}
                >
                    <Search className="size-5" />
                </IconButton>
                {isExpanded && portalElement && mobileInputStyle
                    ? createPortal(
                          <div
                              ref={mobileInputRootRef}
                              className="md:hidden"
                              style={mobileInputStyle}
                          >
                              <Input
                                  value={value}
                                  onChange={onChange}
                                  placeholder={placeholder}
                                  startDecorator={
                                      <Search className="size-5 shrink-0 ml-3" />
                                  }
                                  className={cx('w-full', inputClassName)}
                              />
                          </div>,
                          portalElement,
                      )
                    : null}
                {isExpanded && !portalElement && (
                    <div
                        ref={mobileInputRootRef}
                        className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))]"
                    >
                        <Input
                            value={value}
                            onChange={onChange}
                            placeholder={placeholder}
                            startDecorator={
                                <Search className="size-5 shrink-0 ml-3" />
                            }
                            className={inputClassName}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
