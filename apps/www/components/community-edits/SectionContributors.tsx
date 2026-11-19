'use client';

import { Link } from '@gredice/ui/Link';
import { Popper } from '@gredice/ui/Popper';
import { publicUserProfileHref } from '@gredice/ui/PublicChrome';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { cx } from '@gredice/ui/utils';
import { useEffect, useId, useRef, useState } from 'react';
import type { CommunityContributorView } from './communityContributors';
import {
    describeOtherContributors,
    formatCommunityEditDate,
} from './communityContributorsText';

/** Avatars shown in the stack; the newest editor comes first. */
const maxStackedAvatars = 3;
/** Editors named in the list that opens from the stack. */
const maxListedContributors = 5;
/** Lets the pointer travel from the stack to the list without it closing. */
const hoverCloseDelayMs = 180;

/**
 * Who shaped a section: a stack of the latest editors' avatars that opens a
 * short list on hover, click or keyboard activation.
 */
export function SectionContributors({
    contributors,
    label = 'Urednici odjeljka',
    className,
}: {
    contributors: readonly CommunityContributorView[];
    /** Start of the stack's accessible name; the count is appended. */
    label?: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    // A hover preview closes when the pointer leaves; a click or key press
    // pins the list open until it is dismissed.
    const pinnedRef = useRef(false);
    // Only a pinned list hands focus back to the stack when it closes.
    const restoreFocusRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const popupId = useId();

    useEffect(
        () => () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
            }
        },
        [],
    );

    if (contributors.length === 0) {
        return null;
    }

    const stacked = contributors.slice(0, maxStackedAvatars);
    const listed = contributors.slice(0, maxListedContributors);
    const hiddenStackCount = contributors.length - stacked.length;
    const otherContributors = describeOtherContributors(
        contributors.length - listed.length,
    );

    function cancelScheduledClose() {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }

    function handlePointerEnter(pointerType: string) {
        if (pointerType !== 'mouse') {
            return;
        }
        cancelScheduledClose();
        setOpen(true);
    }

    function handlePointerLeave(pointerType: string) {
        if (pointerType !== 'mouse' || pinnedRef.current) {
            return;
        }
        cancelScheduledClose();
        closeTimerRef.current = setTimeout(() => {
            closeTimerRef.current = null;
            setOpen(false);
        }, hoverCloseDelayMs);
    }

    function handleOpenChange(nextOpen: boolean, event: Event) {
        cancelScheduledClose();
        const fromTrigger =
            event.target instanceof Element &&
            event.target
                .closest('[data-community-contributors]')
                ?.getAttribute('data-community-contributors') === popupId;

        if (nextOpen) {
            pinnedRef.current = true;
            setOpen(true);
            return;
        }

        // Pressing the stack while it only previews on hover pins the list
        // instead of closing what the visitor is already reading.
        if (fromTrigger && !pinnedRef.current) {
            pinnedRef.current = true;
            return;
        }

        restoreFocusRef.current = pinnedRef.current;
        pinnedRef.current = false;
        setOpen(false);
    }

    function handleOpenAutoFocus(event: Event) {
        // A hover preview must not pull keyboard focus away from the page.
        if (!pinnedRef.current) {
            event.preventDefault();
        }
    }

    function handleCloseAutoFocus(event: Event) {
        if (!restoreFocusRef.current) {
            event.preventDefault();
        }
        restoreFocusRef.current = false;
    }

    return (
        <Popper
            id={popupId}
            open={open}
            onOpenChange={handleOpenChange}
            onOpenAutoFocus={handleOpenAutoFocus}
            onCloseAutoFocus={handleCloseAutoFocus}
            side="top"
            align="end"
            aria-label={`${label} – ${contributors.length}`}
            className="w-64 p-2"
            onPointerEnter={(event) => handlePointerEnter(event.pointerType)}
            onPointerLeave={(event) => handlePointerLeave(event.pointerType)}
            trigger={
                <button
                    type="button"
                    data-community-contributors={popupId}
                    onPointerEnter={(event) =>
                        handlePointerEnter(event.pointerType)
                    }
                    onPointerLeave={(event) =>
                        handlePointerLeave(event.pointerType)
                    }
                    className={cx(
                        'relative inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-1 transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
                        className,
                    )}
                >
                    {/* The name comes from the content, so the initials a
                        visitor sees are part of what a screen reader says. */}
                    <span className="sr-only">
                        {label} – {contributors.length}:
                    </span>
                    <span className="flex -space-x-2">
                        {stacked.map((contributor) => (
                            <UserAvatar
                                key={contributor.publicId}
                                avatarUrl={contributor.avatarUrl}
                                displayName={contributor.displayName}
                                decorativeImage
                                size="sm"
                                className="ring-2 ring-background"
                            />
                        ))}
                    </span>
                    {hiddenStackCount > 0 ? (
                        <span className="pr-1 text-xs font-semibold tabular-nums text-muted-foreground">
                            +{hiddenStackCount}
                        </span>
                    ) : null}
                </button>
            }
        >
            <p className="px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            <ul className="flex flex-col">
                {listed.map((contributor) => {
                    const editedAt = formatCommunityEditDate(
                        contributor.lastEditedAt,
                    );
                    return (
                        <li key={contributor.publicId}>
                            <Link
                                href={publicUserProfileHref(
                                    contributor.publicId,
                                )}
                                className="group flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                            >
                                <UserAvatar
                                    avatarUrl={contributor.avatarUrl}
                                    displayName={contributor.displayName}
                                    decorativeImage
                                    size="sm"
                                    className="size-8"
                                />
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold group-hover:underline">
                                        {contributor.displayName}
                                    </span>
                                    {editedAt ? (
                                        <span className="block text-xs text-muted-foreground">
                                            Zadnja izmjena {editedAt}
                                        </span>
                                    ) : null}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
            {otherContributors ? (
                <p className="px-2 pb-1 pt-1 text-xs text-muted-foreground">
                    {otherContributors}
                </p>
            ) : null}
        </Popper>
    );
}
