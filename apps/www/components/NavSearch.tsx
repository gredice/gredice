'use client';

import { type components, directoriesClient } from '@gredice/client';
import { IconButton } from '@gredice/ui/IconButton';
import { Close, LoaderSpinner, Search } from '@gredice/ui/icons';
import { LoadingIndicator } from '@gredice/ui/LoadingIndicator';
import { cx } from '@gredice/ui/utils';
import { usePostHog } from '@posthog/next';
import { useQuery } from '@tanstack/react-query';
import {
    type ChangeEvent,
    type FormEvent,
    type KeyboardEvent,
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import { DirectorySearchResultVisual } from './search/DirectorySearchResultVisual';
import { SearchCategoryFilters } from './search/SearchCategoryFilters';
import {
    navSearchLimit,
    type SearchCategoryValue,
    searchCategoryParam,
    searchPageHref,
} from './search/searchCategories';

type SearchResult = components['schemas']['directory-search-result'];

type NavSearchProps = {
    className?: string;
};

function useDebouncedValue(value: string, delayMs: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [delayMs, value]);

    return debouncedValue;
}

async function fetchSearchResults(
    query: string,
    category: SearchCategoryValue,
): Promise<SearchResult[]> {
    const { data, error } = await directoriesClient().GET('/search', {
        params: {
            query: {
                q: query,
                category: searchCategoryParam(category),
                limit: navSearchLimit,
            },
        },
    });

    if (error) {
        throw new Error('Search request failed');
    }

    return data?.results ?? [];
}

function localHref(href: string) {
    try {
        const baseUrl =
            typeof window === 'undefined'
                ? 'https://www.gredice.com'
                : window.location.origin;
        const parsed = new URL(href, baseUrl);
        const isCurrentOrigin =
            typeof window !== 'undefined' &&
            parsed.origin === window.location.origin;

        if (parsed.hostname === 'www.gredice.com' || isCurrentOrigin) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
    } catch {
        return href;
    }

    return href;
}

function searchShortcutLabel() {
    const isTouchDevice =
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) {
        return null;
    }

    const platform = navigator.platform || navigator.userAgent;
    return /Mac|iPhone|iPad|iPod/u.test(platform) ? '⌘K' : 'Ctrl K';
}

function SearchShortcutHint({ label }: { label: string }) {
    if (label === '⌘K') {
        return (
            <kbd className="ml-auto inline-flex h-6 shrink-0 items-center justify-center gap-0.5 rounded-md border border-muted-foreground/20 bg-muted/60 px-1.5 font-medium leading-none text-muted-foreground">
                <span className="text-sm leading-none">⌘</span>
                <span className="text-[11px] leading-none">K</span>
            </kbd>
        );
    }

    return (
        <kbd className="ml-auto inline-flex h-6 shrink-0 items-center justify-center rounded-md border border-muted-foreground/20 bg-muted/60 px-1.5 text-[11px] font-medium leading-none text-muted-foreground">
            <span>Ctrl K</span>
        </kbd>
    );
}

export function NavSearch({ className }: NavSearchProps) {
    const posthog = usePostHog();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeCategory, setActiveCategory] =
        useState<SearchCategoryValue>('all');
    const [shortcutLabel, setShortcutLabel] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const desktopInputRef = useRef<HTMLInputElement>(null);
    const panelInputRef = useRef<HTMLInputElement>(null);
    const resultsId = useId();
    const trimmedQuery = query.trim();
    const debouncedQuery = useDebouncedValue(trimmedQuery, 180);

    const searchQuery = useQuery({
        queryKey: ['public-nav-search', debouncedQuery, activeCategory],
        queryFn: () => fetchSearchResults(debouncedQuery, activeCategory),
        enabled: isOpen && debouncedQuery.length >= 2,
        staleTime: 60_000,
    });

    const results = debouncedQuery.length >= 2 ? (searchQuery.data ?? []) : [];
    const isSearching =
        trimmedQuery.length >= 2 &&
        (searchQuery.isFetching || trimmedQuery !== debouncedQuery);
    const hasMoreResults = !isSearching && results.length === navSearchLimit;
    const moreResultsHref = searchPageHref({
        query: trimmedQuery,
        category: activeCategory,
    });

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handlePointerDown(event: PointerEvent) {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }

            if (!rootRef.current?.contains(target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [isOpen]);

    const focusSearchInput = useCallback(() => {
        window.requestAnimationFrame(() => {
            if (window.matchMedia('(min-width: 1280px)').matches) {
                desktopInputRef.current?.focus();
                return;
            }

            panelInputRef.current?.focus();
        });
    }, []);

    const openPanel = () => {
        setIsOpen(true);
    };

    const openPanelFromButton = () => {
        setIsOpen(true);
        window.requestAnimationFrame(() => {
            panelInputRef.current?.focus();
        });
    };

    useEffect(() => {
        setShortcutLabel(searchShortcutLabel());

        function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
            if (
                event.defaultPrevented ||
                event.key.toLocaleLowerCase('en-US') !== 'k' ||
                (!event.metaKey && !event.ctrlKey) ||
                event.altKey
            ) {
                return;
            }

            event.preventDefault();
            setIsOpen(true);
            setActiveIndex(0);
            focusSearchInput();
        }

        document.addEventListener('keydown', handleGlobalKeyDown);

        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [focusSearchInput]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);
        setActiveIndex(0);
        setIsOpen(true);
    };

    const handleCategorySelect = (category: SearchCategoryValue) => {
        setActiveCategory(category);
        setActiveIndex(0);
        setIsOpen(true);
        focusSearchInput();
    };

    const navigateTo = (href: string) => {
        window.location.assign(href);
    };

    const navigateToResult = (result: SearchResult, index: number) => {
        posthog?.capture('public_nav_search_result_clicked', {
            category: result.category,
            href: result.href,
            queryLength: trimmedQuery.length,
            rank: index + 1,
        });
        navigateTo(localHref(result.href));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (trimmedQuery.length < 2) {
            return;
        }

        const activeResult = results[activeIndex];
        if (activeResult) {
            navigateToResult(activeResult, activeIndex);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            event.currentTarget.blur();
            return;
        }

        if (results.length === 0) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) =>
                current + 1 >= results.length ? 0 : current + 1,
            );
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) =>
                current - 1 < 0 ? results.length - 1 : current - 1,
            );
        }
    };

    const clearSearch = (focusPanelInput = false) => {
        setQuery('');
        setActiveIndex(0);
        setIsOpen(true);
        window.requestAnimationFrame(() => {
            if (focusPanelInput) {
                panelInputRef.current?.focus();
                return;
            }

            desktopInputRef.current?.focus();
        });
    };

    const panelState = (() => {
        if (trimmedQuery.length === 0) {
            return 'Upiši pojam za pretragu.';
        }

        if (trimmedQuery.length < 2) {
            return 'Upiši barem 2 znaka.';
        }

        if (searchQuery.isError) {
            return 'Nešto nije u redu s pretragom.';
        }

        if (!isSearching && results.length === 0) {
            return 'Nema rezultata za zadani pojam.';
        }

        return null;
    })();

    return (
        <div ref={rootRef} className={cx('relative', className)}>
            <search aria-label="Pretraga" className="hidden xl:block">
                <form onSubmit={handleSubmit}>
                    <div className="flex h-10 w-64 items-center rounded-full border border-muted-foreground/20 bg-background pl-3 pr-2 shadow-[0_2px_10px_rgba(38,31,24,0.10)] ring-offset-background transition-[background-color,border-color,box-shadow] duration-200 hover:border-muted-foreground/30 hover:bg-card hover:shadow-[0_8px_24px_rgba(38,31,24,0.16)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 2xl:w-72">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <input
                            ref={desktopInputRef}
                            type="search"
                            value={query}
                            onChange={handleChange}
                            onFocus={openPanel}
                            onKeyDown={handleKeyDown}
                            role="combobox"
                            aria-label="Pretraga"
                            aria-expanded={isOpen}
                            aria-controls={resultsId}
                            aria-autocomplete="list"
                            aria-keyshortcuts={
                                shortcutLabel === '⌘K'
                                    ? 'Meta+K'
                                    : shortcutLabel
                                      ? 'Control+K'
                                      : undefined
                            }
                            placeholder="Pretraga..."
                            className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                        />
                        {query ? (
                            <IconButton
                                className="rounded-full"
                                title="Očisti pretragu"
                                type="button"
                                size="sm"
                                variant="plain"
                                onClick={() => clearSearch()}
                            >
                                <Close className="size-4" />
                            </IconButton>
                        ) : shortcutLabel ? (
                            <SearchShortcutHint label={shortcutLabel} />
                        ) : null}
                    </div>
                </form>
            </search>

            <IconButton
                className="rounded-full transition-[background-color,box-shadow] duration-200 hover:bg-accent hover:shadow-[0_4px_14px_rgba(38,31,24,0.14)] xl:hidden"
                title="Pretraga"
                type="button"
                variant="plain"
                onClick={openPanelFromButton}
            >
                <Search className="size-5" />
            </IconButton>

            {isOpen ? (
                <div
                    className="fixed left-3 right-3 top-20 z-50 overflow-hidden rounded-xl border border-border/70 bg-background shadow-2xl ring-1 ring-black/5 xl:absolute xl:left-auto xl:right-0 xl:top-12 xl:w-[28rem]"
                    role="dialog"
                    aria-label="Pretraga"
                >
                    <search
                        aria-label="Pretraga"
                        className="border-b xl:hidden"
                    >
                        <form onSubmit={handleSubmit}>
                            <div className="flex h-12 items-center px-3">
                                <Search className="size-5 shrink-0 text-muted-foreground" />
                                <input
                                    ref={panelInputRef}
                                    type="search"
                                    value={query}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    role="combobox"
                                    aria-label="Pretraga"
                                    aria-expanded={isOpen}
                                    aria-controls={resultsId}
                                    aria-autocomplete="list"
                                    placeholder="Pretraga..."
                                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                                />
                                <IconButton
                                    className={cx(
                                        'rounded-full',
                                        query ? 'visible' : 'invisible',
                                    )}
                                    title="Očisti pretragu"
                                    type="button"
                                    size="sm"
                                    variant="plain"
                                    onClick={() => clearSearch(true)}
                                >
                                    <Close className="size-4" />
                                </IconButton>
                            </div>
                        </form>
                    </search>

                    {isSearching ? (
                        <LoadingIndicator aria-hidden="true" />
                    ) : null}

                    <SearchCategoryFilters
                        activeCategory={activeCategory}
                        controlsId={resultsId}
                        onSelect={handleCategorySelect}
                    />

                    <div
                        id={resultsId}
                        role="listbox"
                        className="max-h-[min(32rem,calc(100vh-6rem))] overflow-y-auto p-2"
                    >
                        {isSearching ? (
                            <div className="flex items-center gap-3 px-3 py-5 text-sm text-muted-foreground">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <LoaderSpinner className="size-4 animate-spin" />
                                </span>
                                <span className="font-medium">Pretraga...</span>
                            </div>
                        ) : null}

                        {panelState && !isSearching ? (
                            <div className="px-3 py-6 text-sm text-muted-foreground">
                                {panelState}
                            </div>
                        ) : null}

                        {!isSearching && results.length > 0 ? (
                            <div className="space-y-1">
                                {results.map((result, index) => {
                                    const href = localHref(result.href);
                                    const isActive = index === activeIndex;

                                    return (
                                        <a
                                            key={`${result.entityType}-${result.entityId}`}
                                            id={`${resultsId}-${index}`}
                                            href={href}
                                            role="option"
                                            aria-selected={isActive}
                                            className={cx(
                                                'flex gap-3 rounded-lg px-3 py-2 outline-none transition-colors',
                                                isActive
                                                    ? 'bg-primary/10'
                                                    : 'hover:bg-muted/70 focus-visible:bg-muted/70',
                                            )}
                                            onMouseEnter={() =>
                                                setActiveIndex(index)
                                            }
                                            onClick={() => {
                                                posthog?.capture(
                                                    'public_nav_search_result_clicked',
                                                    {
                                                        category:
                                                            result.category,
                                                        href: result.href,
                                                        queryLength:
                                                            trimmedQuery.length,
                                                        rank: index + 1,
                                                    },
                                                );
                                            }}
                                        >
                                            <DirectorySearchResultVisual
                                                result={result}
                                                className="mt-0.5"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate text-sm font-medium">
                                                        {result.title}
                                                    </span>
                                                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                        {result.categoryLabel}
                                                    </span>
                                                </span>
                                                {result.summary ? (
                                                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                                                        {result.summary}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </a>
                                    );
                                })}
                                {hasMoreResults ? (
                                    <a
                                        href={moreResultsHref}
                                        className="mt-1 flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
                                        onClick={() => {
                                            posthog?.capture(
                                                'public_nav_search_more_results_clicked',
                                                {
                                                    category: activeCategory,
                                                    queryLength:
                                                        trimmedQuery.length,
                                                    resultCount: results.length,
                                                },
                                            );
                                        }}
                                    >
                                        Prikaži više rezultata
                                    </a>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
