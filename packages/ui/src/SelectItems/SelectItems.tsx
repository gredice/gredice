'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import type { HTMLAttributes, ReactNode } from 'react';
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Check, Down, Search, Up } from '../icons';
import type { UiDirection } from '../lib/primitiveTypes';
import { Stack } from '../Stack';
import { cx } from '../utils';

const EMPTY_VALUE = '__gredice_select_empty__';
const SEARCH_ITEM_THRESHOLD = 5;
const dialogSelectStack: symbol[] = [];

const triggerClassName =
    'flex h-10 w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground';
const positionerClassName =
    'z-50 w-[var(--anchor-width)] min-w-32 max-w-[var(--available-width)]';
const popupClassName =
    'relative max-h-[min(24rem,var(--available-height))] min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-hidden data-[side=bottom]:translate-y-1 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:-translate-x-1 data-[side=left]:slide-in-from-right-2 data-[side=right]:translate-x-1 data-[side=right]:slide-in-from-left-2 data-[side=top]:-translate-y-1 data-[side=top]:slide-in-from-bottom-2 data-[starting-style]:animate-in data-[starting-style]:fade-in-0 data-[starting-style]:zoom-in-95 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 motion-reduce:animate-none motion-reduce:transition-none';
const itemClassName =
    'relative flex w-full cursor-default select-none items-center rounded-xs py-1.5 pl-8 pr-2 text-sm outline-hidden data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

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
    'defaultValue' | 'dir' | 'onChange'
> & {
    autoComplete?: string;
    defaultOpen?: boolean;
    value?: T;
    defaultValue?: T;
    dir?: UiDirection;
    disabled?: boolean;
    form?: string;
    name?: string;
    onOpenChange?(open: boolean): void;
    onValueChange?(value: T): void;
    open?: boolean;
    required?: boolean;
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

function toFormValue(value: string) {
    return value === EMPTY_VALUE ? '' : value;
}

function itemLabel<T extends string>(item: SelectItem<T>) {
    return item.content ?? item.label ?? item.value;
}

function itemTextValue<T extends string>(item: SelectItem<T>) {
    if (typeof item.content === 'string') {
        return item.content;
    }

    if (typeof item.label === 'string') {
        return item.label;
    }

    return item.title ?? item.value;
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

export function SelectItems<T extends string>({
    autoComplete,
    className,
    clientSideFilter,
    container,
    defaultOpen,
    defaultValue,
    dir,
    disabled,
    emptySearchText = 'Nema rezultata.',
    form,
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
    required,
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
    const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
    const [internalSearchValue, setInternalSearchValue] = useState('');
    const [dialogPortalContainer, setDialogPortalContainer] =
        useState<HTMLElement>();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const escapeBoundaryId = useRef(Symbol('select-escape-boundary'));
    const isOpen = open ?? internalOpen;
    const shouldClientFilter = clientSideFilter ?? !onSearchValueChange;
    const searchQuery = searchValue ?? internalSearchValue;
    const hasControlledServerSearch =
        Boolean(onSearchValueChange) && !shouldClientFilter;
    const shouldShowSearch =
        searchable ??
        (items.length > SEARCH_ITEM_THRESHOLD || hasControlledServerSearch);
    const isSearchActive =
        shouldShowSearch &&
        (shouldClientFilter || Boolean(onSearchValueChange));
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
    const itemData = useMemo(() => {
        const encodedItems: string[] = [];
        const itemByValue = new Map<string, SelectItem<T>>();
        const originalValueByEncodedValue = new Map<string, T>();
        const selectRootItems: Array<{ label: ReactNode; value: string }> = [];

        for (const item of items) {
            const encodedValue = toSelectValue(item.value) ?? item.value;
            encodedItems.push(encodedValue);
            itemByValue.set(encodedValue, item);
            originalValueByEncodedValue.set(encodedValue, item.value);
            selectRootItems.push({
                label: itemLabel(item),
                value: encodedValue,
            });
        }

        return {
            encodedItems,
            itemByValue,
            originalValueByEncodedValue,
            selectRootItems,
        };
    }, [items]);
    const {
        encodedItems,
        itemByValue,
        originalValueByEncodedValue,
        selectRootItems,
    } = itemData;
    const visibleEncodedItems = useMemo(() => {
        if (
            !isSearchActive ||
            !shouldClientFilter ||
            normalizedSearchQuery.length === 0
        ) {
            return encodedItems;
        }

        return encodedItems.filter((encodedValue) => {
            const item = itemByValue.get(encodedValue);
            return item
                ? itemSearchText(item).includes(normalizedSearchQuery)
                : false;
        });
    }, [
        encodedItems,
        isSearchActive,
        itemByValue,
        normalizedSearchQuery,
        shouldClientFilter,
    ]);
    const resolvedPortalContainer = container ?? dialogPortalContainer;

    const registerTriggerElement = useCallback(
        (element: HTMLButtonElement | null) => {
            setDialogPortalContainer(
                element?.closest<HTMLElement>(
                    '[role="dialog"], [role="alertdialog"]',
                ) ?? undefined,
            );
        },
        [],
    );

    const getItemTextValue = useCallback(
        (encodedValue: string) => {
            const item = itemByValue.get(encodedValue);
            return item ? itemTextValue(item) : encodedValue;
        },
        [itemByValue],
    );

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            setInternalOpen(nextOpen);
            onOpenChange?.(nextOpen);
        },
        [onOpenChange],
    );

    const clearSearch = useCallback(() => {
        if (searchValue === undefined) {
            setInternalSearchValue('');
        }

        onSearchValueChange?.('');
    }, [onSearchValueChange, searchValue]);

    const handleComboboxOpenChange = useCallback(
        (
            nextOpen: boolean,
            eventDetails: ComboboxPrimitive.Root.ChangeEventDetails,
        ) => {
            if (
                !nextOpen &&
                eventDetails.reason === 'escape-key' &&
                searchQuery
            ) {
                eventDetails.cancel();
                clearSearch();
                return;
            }

            handleOpenChange(nextOpen);
        },
        [clearSearch, handleOpenChange, searchQuery],
    );

    const handleSearchValueChange = useCallback(
        (
            nextValue: string,
            eventDetails: ComboboxPrimitive.Root.ChangeEventDetails,
        ) => {
            if (eventDetails.reason === 'input-clear') {
                return;
            }

            if (searchValue === undefined) {
                setInternalSearchValue(nextValue);
            }

            onSearchValueChange?.(nextValue);
        },
        [onSearchValueChange, searchValue],
    );

    const handleEncodedValueChange = useCallback(
        (nextValue: string | null) => {
            if (nextValue === null) {
                return;
            }

            const originalValue = originalValueByEncodedValue.get(nextValue);
            if (originalValue !== undefined) {
                onValueChange?.(originalValue);
            }
        },
        [onValueChange, originalValueByEncodedValue],
    );

    useEffect(() => {
        if (!isOpen || !isSearchActive) {
            return;
        }

        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        if (isCoarsePointer) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            searchInputRef.current?.focus();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [isOpen, isSearchActive]);

    useEffect(() => {
        if (!isOpen && searchValue === undefined && internalSearchValue) {
            setInternalSearchValue('');
            onSearchValueChange?.('');
        }
    }, [internalSearchValue, isOpen, onSearchValueChange, searchValue]);

    useEffect(() => {
        if (!isOpen || !dialogPortalContainer) {
            return;
        }

        const boundaryId = escapeBoundaryId.current;
        dialogSelectStack.push(boundaryId);

        function handleEscape(event: KeyboardEvent) {
            if (
                event.key !== 'Escape' ||
                dialogSelectStack.at(-1) !== boundaryId
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (isSearchActive && searchQuery) {
                clearSearch();
                return;
            }

            handleOpenChange(false);
        }

        window.addEventListener('keydown', handleEscape, { capture: true });
        return () => {
            window.removeEventListener('keydown', handleEscape, {
                capture: true,
            });
            const stackIndex = dialogSelectStack.lastIndexOf(boundaryId);
            if (stackIndex >= 0) {
                dialogSelectStack.splice(stackIndex, 1);
            }
        };
    }, [
        clearSearch,
        dialogPortalContainer,
        handleOpenChange,
        isOpen,
        isSearchActive,
        searchQuery,
    ]);

    const rootValue = toSelectValue(value);
    const rootDefaultValue = toSelectValue(defaultValue);
    const rootClassName = cx(
        triggerClassName,
        variant === 'outlined' && 'border border-input bg-background',
        variant === 'plain' && 'bg-transparent',
    );

    return (
        <Stack {...rest} className={className} dir={dir} spacing={1}>
            {label ? (
                <label
                    className="text-sm font-medium"
                    htmlFor={inputId}
                    id={labelId}
                >
                    {label}
                </label>
            ) : null}
            {isSearchActive ? (
                <ComboboxPrimitive.Root
                    autoComplete={autoComplete}
                    defaultValue={rootDefaultValue}
                    disabled={disabled}
                    filteredItems={visibleEncodedItems}
                    form={form}
                    itemToStringLabel={getItemTextValue}
                    itemToStringValue={toFormValue}
                    items={encodedItems}
                    modal
                    name={name}
                    onInputValueChange={handleSearchValueChange}
                    onOpenChange={handleComboboxOpenChange}
                    onValueChange={handleEncodedValueChange}
                    open={isOpen}
                    required={required}
                    value={rootValue}
                >
                    <ComboboxPrimitive.Trigger
                        ref={registerTriggerElement}
                        aria-label={label ?? placeholder}
                        aria-labelledby={labelId}
                        className={rootClassName}
                        id={inputId}
                    >
                        <ComboboxPrimitive.Value placeholder={placeholder}>
                            {(selectedValue: string | null) => {
                                const item = selectedValue
                                    ? itemByValue.get(selectedValue)
                                    : undefined;

                                return (
                                    <span className="line-clamp-1 flex min-w-0 items-center gap-2">
                                        {item?.icon}
                                        <span className="line-clamp-1">
                                            {item
                                                ? itemLabel(item)
                                                : selectedValue
                                                  ? toFormValue(selectedValue)
                                                  : placeholder}
                                        </span>
                                    </span>
                                );
                            }}
                        </ComboboxPrimitive.Value>
                        <Down
                            aria-hidden
                            className="size-4 shrink-0 opacity-50"
                        />
                    </ComboboxPrimitive.Trigger>
                    <ComboboxPrimitive.Portal
                        container={resolvedPortalContainer}
                    >
                        <ComboboxPrimitive.Positioner
                            align="start"
                            className={positionerClassName}
                            collisionPadding={8}
                            sideOffset={4}
                        >
                            <ComboboxPrimitive.Popup
                                className={popupClassName}
                                initialFocus={false}
                            >
                                <div className="border-b p-1">
                                    <div className="flex h-9 items-center rounded-sm border border-input bg-background px-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                                        <Search className="size-4 shrink-0 text-muted-foreground" />
                                        <ComboboxPrimitive.Input
                                            ref={searchInputRef}
                                            aria-label={searchPlaceholder}
                                            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-hidden placeholder:text-muted-foreground"
                                            placeholder={searchPlaceholder}
                                            role="searchbox"
                                            type="search"
                                        />
                                    </div>
                                </div>
                                <ComboboxPrimitive.Empty className="px-3 py-2 text-sm text-muted-foreground">
                                    {emptySearchText}
                                </ComboboxPrimitive.Empty>
                                <ComboboxPrimitive.List className="max-h-[calc(min(24rem,var(--available-height))-3rem)] overflow-y-auto p-1">
                                    {(encodedValue: string, index: number) => {
                                        const item =
                                            itemByValue.get(encodedValue);
                                        if (!item) {
                                            return null;
                                        }

                                        return (
                                            <ComboboxPrimitive.Item
                                                className={itemClassName}
                                                disabled={item.disabled}
                                                index={index}
                                                key={encodedValue}
                                                title={item.title}
                                                value={encodedValue}
                                            >
                                                <span className="absolute left-2 flex size-3.5 items-center justify-center">
                                                    <ComboboxPrimitive.ItemIndicator>
                                                        <Check className="size-4" />
                                                    </ComboboxPrimitive.ItemIndicator>
                                                </span>
                                                <span className="flex min-w-0 items-center gap-2">
                                                    {item.icon}
                                                    <span className="line-clamp-1">
                                                        {itemLabel(item)}
                                                    </span>
                                                </span>
                                            </ComboboxPrimitive.Item>
                                        );
                                    }}
                                </ComboboxPrimitive.List>
                            </ComboboxPrimitive.Popup>
                        </ComboboxPrimitive.Positioner>
                    </ComboboxPrimitive.Portal>
                </ComboboxPrimitive.Root>
            ) : (
                <SelectPrimitive.Root
                    autoComplete={autoComplete}
                    defaultValue={rootDefaultValue}
                    disabled={disabled}
                    form={form}
                    itemToStringLabel={getItemTextValue}
                    itemToStringValue={toFormValue}
                    items={selectRootItems}
                    name={name}
                    onOpenChange={handleOpenChange}
                    onValueChange={handleEncodedValueChange}
                    open={isOpen}
                    required={required}
                    value={rootValue}
                >
                    <SelectPrimitive.Trigger
                        ref={registerTriggerElement}
                        aria-label={label ?? placeholder}
                        aria-labelledby={labelId}
                        className={rootClassName}
                        id={inputId}
                    >
                        <SelectPrimitive.Value
                            className="line-clamp-1 flex min-w-0 items-center gap-2"
                            placeholder={placeholder}
                        >
                            {(selectedValue: string | null) => {
                                const item = selectedValue
                                    ? itemByValue.get(selectedValue)
                                    : undefined;

                                return (
                                    <>
                                        {item?.icon}
                                        <span className="line-clamp-1">
                                            {item
                                                ? itemLabel(item)
                                                : selectedValue
                                                  ? toFormValue(selectedValue)
                                                  : placeholder}
                                        </span>
                                    </>
                                );
                            }}
                        </SelectPrimitive.Value>
                        <Down
                            aria-hidden
                            className="size-4 shrink-0 opacity-50"
                        />
                    </SelectPrimitive.Trigger>
                    <SelectPrimitive.Portal container={resolvedPortalContainer}>
                        <SelectPrimitive.Positioner
                            align="start"
                            alignItemWithTrigger={false}
                            className={positionerClassName}
                            collisionPadding={8}
                            sideOffset={4}
                        >
                            <SelectPrimitive.Popup className={popupClassName}>
                                <SelectPrimitive.ScrollUpArrow className="flex cursor-default items-center justify-center py-1">
                                    <Up className="size-4" />
                                </SelectPrimitive.ScrollUpArrow>
                                <SelectPrimitive.List className="max-h-[min(24rem,var(--available-height))] overflow-y-auto p-1">
                                    {encodedItems.length > 0 ? (
                                        encodedItems.map((encodedValue) => {
                                            const item =
                                                itemByValue.get(encodedValue);
                                            if (!item) {
                                                return null;
                                            }

                                            return (
                                                <SelectPrimitive.Item
                                                    className={itemClassName}
                                                    disabled={item.disabled}
                                                    key={encodedValue}
                                                    label={itemTextValue(item)}
                                                    title={item.title}
                                                    value={encodedValue}
                                                >
                                                    <span className="absolute left-2 flex size-3.5 items-center justify-center">
                                                        <SelectPrimitive.ItemIndicator>
                                                            <Check className="size-4" />
                                                        </SelectPrimitive.ItemIndicator>
                                                    </span>
                                                    <SelectPrimitive.ItemText>
                                                        <span className="flex min-w-0 items-center gap-2">
                                                            {item.icon}
                                                            <span className="line-clamp-1">
                                                                {itemLabel(
                                                                    item,
                                                                )}
                                                            </span>
                                                        </span>
                                                    </SelectPrimitive.ItemText>
                                                </SelectPrimitive.Item>
                                            );
                                        })
                                    ) : (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                            {emptySearchText}
                                        </div>
                                    )}
                                </SelectPrimitive.List>
                                <SelectPrimitive.ScrollDownArrow className="flex cursor-default items-center justify-center py-1">
                                    <Down className="size-4" />
                                </SelectPrimitive.ScrollDownArrow>
                            </SelectPrimitive.Popup>
                        </SelectPrimitive.Positioner>
                    </SelectPrimitive.Portal>
                </SelectPrimitive.Root>
            )}
            {helperText ? (
                <span className="text-sm text-red-600 dark:text-red-300">
                    {helperText}
                </span>
            ) : null}
        </Stack>
    );
}
