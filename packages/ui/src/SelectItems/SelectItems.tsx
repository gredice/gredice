'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import type {
    ChangeEvent,
    ComponentPropsWithoutRef,
    HTMLAttributes,
    KeyboardEvent,
    ReactNode,
} from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Down, Search, Up } from '../icons';
import { Stack } from '../Stack';
import { cx } from '../utils';

const EMPTY_VALUE = '__gredice_select_empty__';
const SEARCH_ITEM_THRESHOLD = 5;

export type SelectItem<T extends string> = {
    value: T;
    icon?: ReactNode;
    label?: ReactNode | string;
    title?: string;
    content?: ReactNode | string | undefined;
    disabled?: boolean;
};

export type SelectItemsProps<T extends string> = Omit<
    HTMLAttributes<HTMLDivElement>,
    'defaultValue' | 'onChange'
> &
    Omit<
        ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
        'defaultValue' | 'onValueChange' | 'value'
    > & {
        value?: T;
        defaultValue?: T;
        onValueChange?(value: T): void;
        label?: string;
        items: SelectItem<T>[];
        placeholder?: string;
        helperText?: string;
        variant?: 'outlined' | 'plain';
        container?: HTMLElement;
        /** Defaults to true when the select has more than five items. */
        searchable?: boolean;
        searchPlaceholder?: string;
        searchValue?: string;
        /** Supplying this disables client filtering unless `clientSideFilter` is true. */
        onSearchValueChange?(value: string): void;
        /** Set to false for paginated or server-filtered option sets. */
        clientSideFilter?: boolean;
        emptySearchText?: string;
    };

function toSelectValue(value: string | undefined) {
    if (value === undefined) {
        return undefined;
    }

    return value === '' ? EMPTY_VALUE : value;
}

function fromSelectValue<T extends string>(value: string) {
    return (value === EMPTY_VALUE ? '' : value) as T;
}

function itemLabel<T extends string>(item: SelectItem<T>) {
    return item.content ?? item.label ?? item.value;
}

function itemSearchText<T extends string>(item: SelectItem<T>) {
    return [
        item.value,
        item.title,
        typeof item.label === 'string' ? item.label : undefined,
        typeof item.content === 'string' ? item.content : undefined,
    ]
        .filter((part): part is string => Boolean(part))
        .join(' ')
        .toLocaleLowerCase();
}

function isInputEditingKey(event: KeyboardEvent<HTMLInputElement>) {
    return (
        event.key.length === 1 ||
        event.key === 'Backspace' ||
        event.key === 'Delete'
    );
}

export function SelectItems<T extends string>({
    clientSideFilter,
    className,
    container,
    defaultValue,
    emptySearchText = 'Nema rezultata.',
    helperText,
    id,
    items,
    label,
    name,
    onOpenChange,
    onSearchValueChange,
    onValueChange,
    open,
    placeholder,
    searchable,
    searchPlaceholder = 'Pretraži opcije...',
    searchValue,
    value,
    variant = 'outlined',
    ...rest
}: SelectItemsProps<T>) {
    const generatedId = useId();
    const inputId = id ?? name ?? generatedId;
    const labelId = label ? `label-${inputId}` : undefined;
    const [internalOpen, setInternalOpen] = useState(false);
    const [internalSearchValue, setInternalSearchValue] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isOpen = open ?? internalOpen;
    const shouldShowSearch = searchable ?? items.length > SEARCH_ITEM_THRESHOLD;
    const shouldClientFilter = clientSideFilter ?? !onSearchValueChange;
    const isSearchActive =
        shouldShowSearch &&
        (shouldClientFilter || Boolean(onSearchValueChange));
    const searchQuery = searchValue ?? internalSearchValue;
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
    const visibleItems = useMemo(() => {
        if (
            !isSearchActive ||
            !shouldClientFilter ||
            normalizedSearchQuery.length === 0
        ) {
            return items;
        }

        return items.filter((item) =>
            itemSearchText(item).includes(normalizedSearchQuery),
        );
    }, [isSearchActive, items, normalizedSearchQuery, shouldClientFilter]);

    useEffect(() => {
        if (!isOpen || !isSearchActive) {
            return;
        }

        const timeoutId = setTimeout(() => {
            searchInputRef.current?.focus();
        }, 0);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [isOpen, isSearchActive]);

    useEffect(() => {
        if (!isOpen && searchValue === undefined && internalSearchValue) {
            setInternalSearchValue('');
            onSearchValueChange?.('');
        }
    }, [internalSearchValue, isOpen, onSearchValueChange, searchValue]);

    const handleOpenChange = (nextOpen: boolean) => {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
    };

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;

        if (searchValue === undefined) {
            setInternalSearchValue(nextValue);
        }

        onSearchValueChange?.(nextValue);
    };

    const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape' && searchQuery) {
            event.preventDefault();
            event.stopPropagation();

            if (searchValue === undefined) {
                setInternalSearchValue('');
            }

            onSearchValueChange?.('');
            return;
        }

        if (isInputEditingKey(event)) {
            event.stopPropagation();
        }
    };

    return (
        <Stack className={className} spacing={1}>
            {label ? (
                <label
                    className="text-sm font-medium"
                    htmlFor={inputId}
                    id={labelId}
                >
                    {label}
                </label>
            ) : null}
            <SelectPrimitive.Root
                defaultValue={toSelectValue(defaultValue)}
                name={name}
                onOpenChange={handleOpenChange}
                onValueChange={(nextValue) =>
                    onValueChange?.(fromSelectValue(nextValue))
                }
                open={open}
                value={toSelectValue(value)}
                {...rest}
            >
                <SelectPrimitive.Trigger
                    aria-label={label ?? placeholder}
                    aria-labelledby={labelId}
                    className={cx(
                        'flex h-10 w-full items-center justify-between rounded-md bg-transparent px-3 py-2 text-left text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        '[&>span]:line-clamp-1 data-[placeholder]:text-muted-foreground',
                        variant === 'outlined' && 'border border-input',
                    )}
                    id={inputId}
                >
                    <SelectPrimitive.Value placeholder={placeholder} />
                    <SelectPrimitive.Icon asChild>
                        <Down className="size-4 shrink-0 opacity-50" />
                    </SelectPrimitive.Icon>
                </SelectPrimitive.Trigger>
                <SelectPrimitive.Portal container={container}>
                    <SelectPrimitive.Content
                        className="relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:translate-y-1 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:-translate-x-1 data-[side=left]:slide-in-from-right-2 data-[side=right]:translate-x-1 data-[side=right]:slide-in-from-left-2 data-[side=top]:-translate-y-1 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                        position="popper"
                    >
                        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
                            <Up className="size-4" />
                        </SelectPrimitive.ScrollUpButton>
                        {isSearchActive ? (
                            <div
                                className="border-b p-1"
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                            >
                                <div className="flex h-9 items-center rounded-sm border border-input bg-background px-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                                    <Search className="size-4 shrink-0 text-muted-foreground" />
                                    <input
                                        ref={searchInputRef}
                                        aria-label={searchPlaceholder}
                                        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-hidden placeholder:text-muted-foreground"
                                        onChange={handleSearchChange}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder={searchPlaceholder}
                                        type="search"
                                        value={searchQuery}
                                    />
                                </div>
                            </div>
                        ) : null}
                        <SelectPrimitive.Viewport className="h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] p-1">
                            {visibleItems.length > 0 ? (
                                visibleItems.map((item) => (
                                    <SelectPrimitive.Item
                                        className="relative flex w-full cursor-default select-none items-center rounded-xs py-1.5 pl-8 pr-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                        disabled={item.disabled}
                                        key={item.value || EMPTY_VALUE}
                                        title={item.title}
                                        value={
                                            toSelectValue(item.value) ??
                                            item.value
                                        }
                                    >
                                        <span className="absolute left-2 flex size-3.5 items-center justify-center">
                                            <SelectPrimitive.ItemIndicator>
                                                <Check className="size-4" />
                                            </SelectPrimitive.ItemIndicator>
                                        </span>
                                        <SelectPrimitive.ItemText>
                                            <span className="flex items-center gap-2">
                                                {item.icon}
                                                <span className="line-clamp-1">
                                                    {itemLabel(item)}
                                                </span>
                                            </span>
                                        </SelectPrimitive.ItemText>
                                    </SelectPrimitive.Item>
                                ))
                            ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    {emptySearchText}
                                </div>
                            )}
                        </SelectPrimitive.Viewport>
                        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
                            <Down className="size-4" />
                        </SelectPrimitive.ScrollDownButton>
                    </SelectPrimitive.Content>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
            {helperText ? (
                <span className="text-sm text-red-600 dark:text-red-300">
                    {helperText}
                </span>
            ) : null}
        </Stack>
    );
}
