'use client';

import {
    Dashboard,
    Device,
    File,
    Link as LinkIcon,
    Megaphone,
    Settings,
    SmileHappy,
} from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
    type SettingsSectionInfo,
    settingsSectionGroups,
    settingsSections,
} from '../settingsSections';

type SettingsSectionId = SettingsSectionInfo['id'];

const sectionIcons = {
    'general-settings': <Settings className="size-4" aria-hidden />,
    'directory-settings': <File className="size-4" aria-hidden />,
    'dashboard-settings': <Dashboard className="size-4" aria-hidden />,
    'integration-settings': <LinkIcon className="size-4" aria-hidden />,
    'notification-settings': <Megaphone className="size-4" aria-hidden />,
    'personal-notification-settings': <Device className="size-4" aria-hidden />,
    'feedback-settings': <SmileHappy className="size-4" aria-hidden />,
} satisfies Record<SettingsSectionId, ReactNode>;

const sectionIds = settingsSectionGroups.flatMap((group) =>
    group.sections.map((section) => section.id),
);
const firstSectionId = settingsSections.general.id;
const lastSectionId = settingsSections.feedback.id;

/** A section becomes current once its top passes this distance from the top. */
const ACTIVATION_LINE_PX = 120;

function sectionIdFromHash(hash: string) {
    const value = hash.replace(/^#/, '');

    return sectionIds.find((id) => id === value) ?? null;
}

function isInViewport(id: SettingsSectionId) {
    const rect = document.getElementById(id)?.getBoundingClientRect();

    return Boolean(rect && rect.top < window.innerHeight && rect.bottom > 0);
}

function scrolledSectionId() {
    const page = document.documentElement;
    const scrollable = page.scrollHeight - window.innerHeight;
    if (scrollable > 0 && window.scrollY >= scrollable - 2) {
        // Short sections at the end never reach the activation line.
        return lastSectionId;
    }

    let current: SettingsSectionId = firstSectionId;
    for (const id of sectionIds) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= ACTIVATION_LINE_PX) {
            current = id;
        }
    }

    return current;
}

/**
 * Section links of the settings page: a sticky column beside the content when
 * `SettingsLayout` has room for it and a sticky, horizontally scrolling row
 * above the content otherwise. The link of the section being read is marked
 * as the current location.
 */
export function SettingsSectionNav() {
    const [activeId, setActiveId] = useState<SettingsSectionId>(firstSectionId);
    // The section the admin last jumped to. It stays current while it is on
    // screen and the admin has not scrolled away, so jumping to a short
    // section near the end marks that section, not the one above it.
    const pinnedIdRef = useRef<SettingsSectionId | null>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let frame = 0;

        function update() {
            const pinnedId = pinnedIdRef.current;
            if (pinnedId && isInViewport(pinnedId)) {
                setActiveId(pinnedId);
                return;
            }

            pinnedIdRef.current = null;
            setActiveId(scrolledSectionId());
        }

        function scheduleUpdate() {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(update);
        }

        function pinFromHash() {
            pinnedIdRef.current = sectionIdFromHash(window.location.hash);
            scheduleUpdate();
        }

        function releasePin() {
            pinnedIdRef.current = null;
        }

        pinFromHash();

        // Capture also catches scrolling inside a nested scroll container.
        document.addEventListener('scroll', scheduleUpdate, {
            capture: true,
            passive: true,
        });
        window.addEventListener('resize', scheduleUpdate);
        window.addEventListener('hashchange', pinFromHash);
        window.addEventListener('wheel', releasePin, { passive: true });
        window.addEventListener('touchmove', releasePin, { passive: true });
        window.addEventListener('keydown', releasePin);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('scroll', scheduleUpdate, {
                capture: true,
            });
            window.removeEventListener('resize', scheduleUpdate);
            window.removeEventListener('hashchange', pinFromHash);
            window.removeEventListener('wheel', releasePin);
            window.removeEventListener('touchmove', releasePin);
            window.removeEventListener('keydown', releasePin);
        };
    }, []);

    useEffect(() => {
        // Keep the current link visible in the horizontally scrolling row.
        const scroller = scrollerRef.current;
        if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
            return;
        }

        const link = scroller.querySelector<HTMLElement>(
            `a[href="#${activeId}"]`,
        );
        if (!link) {
            return;
        }

        const scrollerRect = scroller.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        if (
            linkRect.left < scrollerRect.left ||
            linkRect.right > scrollerRect.right
        ) {
            scroller.scrollTo({
                left:
                    scroller.scrollLeft +
                    linkRect.left -
                    scrollerRect.left -
                    (scrollerRect.width - linkRect.width) / 2,
            });
        }
    }, [activeId]);

    function handleSectionClick(id: SettingsSectionId) {
        pinnedIdRef.current = id;
        setActiveId(id);
    }

    return (
        <nav
            aria-label="Odjeljci postavki"
            className="sticky top-0 z-20 -mx-3 min-w-0 self-start border-b bg-[var(--admin-page-content-background)] px-3 py-2 md:-mx-4 md:px-4 @4xl/settings-page:top-4 @4xl/settings-page:mx-0 @4xl/settings-page:border-b-0 @4xl/settings-page:bg-transparent @4xl/settings-page:p-0"
        >
            <div
                ref={scrollerRef}
                className="flex gap-1 overflow-x-auto [scrollbar-width:none] @4xl/settings-page:flex-col @4xl/settings-page:gap-5 @4xl/settings-page:overflow-visible [&::-webkit-scrollbar]:hidden"
            >
                {settingsSectionGroups.map((group, groupIndex) => (
                    <div
                        key={group.id}
                        className="flex shrink-0 items-center gap-1 @4xl/settings-page:block"
                    >
                        {groupIndex > 0 && (
                            <span
                                aria-hidden
                                className="mx-1 h-5 w-px bg-border @4xl/settings-page:hidden"
                            />
                        )}
                        <p
                            id={group.id}
                            className="hidden px-2 pb-1.5 text-xs font-medium text-muted-foreground @4xl/settings-page:block"
                        >
                            {group.label}
                        </p>
                        <ul
                            aria-labelledby={group.id}
                            className="flex gap-1 @4xl/settings-page:flex-col @4xl/settings-page:gap-0.5"
                        >
                            {group.sections.map((section) => {
                                const active = section.id === activeId;

                                return (
                                    <li key={section.id} className="shrink-0">
                                        <a
                                            href={`#${section.id}`}
                                            aria-current={
                                                active ? 'location' : undefined
                                            }
                                            onClick={() =>
                                                handleSectionClick(section.id)
                                            }
                                            className={cx(
                                                'relative flex h-9 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @4xl/settings-page:h-8 @4xl/settings-page:px-2',
                                                active
                                                    ? 'bg-muted font-medium text-foreground shadow-xs ring-1 ring-border/40'
                                                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                                            )}
                                        >
                                            {sectionIcons[section.id]}
                                            <span>
                                                {section.title}
                                                <span className="sr-only">
                                                    {' '}
                                                    – odjeljak ove stranice
                                                </span>
                                            </span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </nav>
    );
}
