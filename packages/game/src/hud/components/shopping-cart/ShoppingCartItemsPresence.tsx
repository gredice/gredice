import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { cx } from '@gredice/ui/utils';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
} from 'react';
import type { ShoppingCartItemData } from '../../../hooks/useShoppingCart';
import { ShoppingCartItem } from './ShoppingCartItem';
import styles from './ShoppingCartItemsPresence.module.css';

type PresenceState = 'entering' | 'exiting' | 'settled';

interface PresenceTransition {
    state: PresenceState;
    transitionId: number;
}

interface ShoppingCartItemPresence extends PresenceTransition {
    item: ShoppingCartItemData;
}

interface ShoppingCartPresenceModel {
    empty: PresenceTransition | null;
    items: ShoppingCartItemPresence[];
    nextTransitionId: number;
}

interface ShoppingCartItemsPresenceProps {
    items: ShoppingCartItemData[];
}

interface PresenceSlotProps extends PresenceTransition {
    children: ReactNode;
    itemId?: ShoppingCartItemData['id'];
    kind: 'empty' | 'item';
    onFinish: (
        kind: 'empty' | 'item',
        itemId: ShoppingCartItemData['id'] | undefined,
        state: PresenceState,
        transitionId: number,
    ) => void;
}

function uniqueItems(items: ShoppingCartItemData[]) {
    return [...new Map(items.map((item) => [item.id, item])).values()];
}

function initialPresenceModel(
    items: ShoppingCartItemData[],
): ShoppingCartPresenceModel {
    const initialItems = uniqueItems(items);

    return {
        empty:
            initialItems.length === 0
                ? { state: 'settled', transitionId: 0 }
                : null,
        items: initialItems.map((item) => ({
            item,
            state: 'settled',
            transitionId: 0,
        })),
        nextTransitionId: 0,
    };
}

function reconcilePresenceModel(
    current: ShoppingCartPresenceModel,
    items: ShoppingCartItemData[],
): ShoppingCartPresenceModel {
    const incomingItems = uniqueItems(items);
    const incomingById = new Map(incomingItems.map((item) => [item.id, item]));
    const retainedIds = new Set<ShoppingCartItemData['id']>();
    let nextTransitionId = current.nextTransitionId;

    const presentItems = current.items.flatMap((entry) => {
        if (retainedIds.has(entry.item.id)) {
            return [];
        }
        retainedIds.add(entry.item.id);

        const incomingItem = incomingById.get(entry.item.id);
        if (!incomingItem) {
            if (entry.state === 'exiting') {
                return [entry];
            }

            nextTransitionId += 1;
            return [
                {
                    ...entry,
                    state: 'exiting' as const,
                    transitionId: nextTransitionId,
                },
            ];
        }

        if (entry.state === 'exiting') {
            nextTransitionId += 1;
            return [
                {
                    item: incomingItem,
                    state: 'entering' as const,
                    transitionId: nextTransitionId,
                },
            ];
        }

        return [{ ...entry, item: incomingItem }];
    });

    for (const [itemIndex, item] of incomingItems.entries()) {
        if (retainedIds.has(item.id)) {
            continue;
        }

        nextTransitionId += 1;
        const nextEntry: ShoppingCartItemPresence = {
            item,
            state: 'entering',
            transitionId: nextTransitionId,
        };
        const laterItem = incomingItems
            .slice(itemIndex + 1)
            .find((candidate) =>
                presentItems.some((entry) => entry.item.id === candidate.id),
            );

        if (laterItem) {
            const insertionIndex = presentItems.findIndex(
                (entry) => entry.item.id === laterItem.id,
            );
            presentItems.splice(insertionIndex, 0, nextEntry);
        } else {
            presentItems.push(nextEntry);
        }
        retainedIds.add(item.id);
    }

    let empty = current.empty;
    if (incomingItems.length === 0) {
        if (!empty || empty.state === 'exiting') {
            nextTransitionId += 1;
            empty = {
                state: 'entering',
                transitionId: nextTransitionId,
            };
        }
    } else if (empty && empty.state !== 'exiting') {
        nextTransitionId += 1;
        empty = {
            state: 'exiting',
            transitionId: nextTransitionId,
        };
    }

    return {
        empty,
        items: presentItems,
        nextTransitionId,
    };
}

function PresenceSlot({
    children,
    itemId,
    kind,
    onFinish,
    state,
    transitionId,
}: PresenceSlotProps) {
    useEffect(() => {
        if (state === 'settled') {
            return;
        }

        const reducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        const durationMs = reducedMotion ? 100 : 150;
        const timeout = window.setTimeout(() => {
            onFinish(kind, itemId, state, transitionId);
        }, durationMs + 50);

        return () => window.clearTimeout(timeout);
    }, [itemId, kind, onFinish, state, transitionId]);

    return (
        <div
            aria-hidden={state === 'exiting' || undefined}
            className={cx(
                styles.slot,
                state === 'entering' && styles.entering,
                state === 'exiting' && styles.exiting,
            )}
            data-shopping-cart-item-id={itemId}
            data-shopping-cart-presence={kind}
            data-shopping-cart-presence-state={state}
            inert={state === 'exiting' || undefined}
            onAnimationEnd={(event) => {
                if (event.target === event.currentTarget) {
                    onFinish(kind, itemId, state, transitionId);
                }
            }}
        >
            {children}
        </div>
    );
}

export function ShoppingCartItemsPresence({
    items,
}: ShoppingCartItemsPresenceProps) {
    const [presence, setPresence] = useState(() => initialPresenceModel(items));

    useLayoutEffect(() => {
        setPresence((current) => reconcilePresenceModel(current, items));
    }, [items]);

    const handlePresenceFinished = useCallback(
        (
            kind: 'empty' | 'item',
            itemId: ShoppingCartItemData['id'] | undefined,
            state: PresenceState,
            transitionId: number,
        ) => {
            setPresence((current) => {
                if (kind === 'empty') {
                    if (
                        !current.empty ||
                        current.empty.state !== state ||
                        current.empty.transitionId !== transitionId
                    ) {
                        return current;
                    }

                    return {
                        ...current,
                        empty:
                            state === 'exiting'
                                ? null
                                : { ...current.empty, state: 'settled' },
                    };
                }

                const itemIndex = current.items.findIndex(
                    (entry) => entry.item.id === itemId,
                );
                const entry = current.items[itemIndex];
                if (
                    !entry ||
                    entry.state !== state ||
                    entry.transitionId !== transitionId
                ) {
                    return current;
                }

                const nextItems = [...current.items];
                if (state === 'exiting') {
                    nextItems.splice(itemIndex, 1);
                } else {
                    nextItems[itemIndex] = { ...entry, state: 'settled' };
                }

                return { ...current, items: nextItems };
            });
        },
        [],
    );

    return (
        <div className={styles.presence} data-shopping-cart-items-presence>
            {presence.items.length > 0 ? (
                <div className={styles.items}>
                    {presence.items.map((entry) => (
                        <PresenceSlot
                            itemId={entry.item.id}
                            key={entry.item.id}
                            kind="item"
                            onFinish={handlePresenceFinished}
                            state={entry.state}
                            transitionId={entry.transitionId}
                        >
                            <ShoppingCartItem item={entry.item} />
                        </PresenceSlot>
                    ))}
                </div>
            ) : null}
            {presence.empty ? (
                <div className={styles.empty}>
                    <PresenceSlot
                        key="empty"
                        kind="empty"
                        onFinish={handlePresenceFinished}
                        state={presence.empty.state}
                        transitionId={presence.empty.transitionId}
                    >
                        <NoDataPlaceholder>Košara je prazna</NoDataPlaceholder>
                    </PresenceSlot>
                </div>
            ) : null}
        </div>
    );
}
