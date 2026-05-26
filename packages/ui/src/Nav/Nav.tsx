'use client';

import type {
    MouseEvent,
    PropsWithChildren,
    ReactElement,
    ReactNode,
} from 'react';
import { useEffect, useId, useState } from 'react';
import { Button } from '../Button';
import { Container } from '../Container';
import { IconButton } from '../IconButton';
import { Close, Menu as MenuIcon } from '../icons';
import { Link } from '../Link';
import { Row } from '../Row';
import { Stack } from '../Stack';
import { cx } from '../utils';

export type NavLinkItem = {
    href: string;
    text: ReactNode;
};

export type PageNavProps = PropsWithChildren<{
    logo: ReactNode;
    links?: (NavLinkItem | ReactElement)[];
}>;

function isNavLinkItem(item: NavLinkItem | ReactElement): item is NavLinkItem {
    return 'text' in item;
}

function renderNavItem(item: NavLinkItem | ReactElement, mobile = false) {
    if (!isNavLinkItem(item)) {
        return item;
    }

    return (
        <Button
            fullWidth={mobile}
            href={item.href}
            key={item.href}
            size="lg"
            variant="plain"
        >
            {item.text}
        </Button>
    );
}

export function PageNav({ logo, links, children }: PageNavProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const menuId = useId();
    const isFloating = isScrolled || mobileMenuOpen;

    useEffect(() => {
        let animationFrame = 0;

        const updateScrolled = () => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(() => {
                setIsScrolled(window.scrollY > 12);
            });
        };

        updateScrolled();
        window.addEventListener('scroll', updateScrolled, { passive: true });

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('scroll', updateScrolled);
        };
    }, []);

    useEffect(() => {
        if (!mobileMenuOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMobileMenuOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mobileMenuOpen]);

    const closeMobileMenu = () => setMobileMenuOpen(false);
    const handleMobileNavClick = (event: MouseEvent<HTMLElement>) => {
        const target = event.target;
        if (target instanceof Element && target.closest('a')) {
            closeMobileMenu();
        }
    };

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40">
            <Container
                padded={false}
                className={cx(
                    'transition-[padding] duration-300 ease-out',
                    isFloating
                        ? 'px-2 pt-2 md:px-4 md:pt-3'
                        : 'px-0 pt-0 md:px-4',
                )}
            >
                <header
                    className={cx(
                        'pointer-events-auto relative flex h-16 items-center border-transparent bg-background/75 backdrop-blur-md transition-[height,border-color,background-color,box-shadow] duration-300 ease-out',
                        isFloating &&
                            'h-14 rounded-2xl border border-border/70 bg-background/80 shadow-lg shadow-foreground/10 backdrop-blur-xl',
                    )}
                >
                    <div className="relative flex h-full w-full min-w-0 items-center justify-between gap-1 px-2 sm:gap-2 sm:px-3 md:px-4">
                        <div className="flex h-full min-w-0 flex-1 flex-col items-start justify-center md:flex-none">
                            <Link
                                className="block min-w-0 [&>svg]:max-w-full"
                                href="/"
                                onClick={closeMobileMenu}
                            >
                                {logo}
                            </Link>
                        </div>
                        <Row spacing={0} className="min-w-0 shrink-0">
                            <nav className="hidden md:block">
                                <Row spacing={0}>
                                    {links?.map((item) => renderNavItem(item))}
                                </Row>
                            </nav>
                            {children && (
                                <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:ml-2">
                                    {children}
                                </div>
                            )}
                            <IconButton
                                aria-controls={menuId}
                                aria-expanded={mobileMenuOpen}
                                aria-label={
                                    mobileMenuOpen
                                        ? 'Zatvori navigaciju'
                                        : 'Otvori navigaciju'
                                }
                                className="ml-1 shrink-0 rounded-full md:hidden"
                                size="md"
                                type="button"
                                variant="plain"
                                onClick={() =>
                                    setMobileMenuOpen((current) => !current)
                                }
                            >
                                {mobileMenuOpen ? (
                                    <Close aria-hidden className="size-5" />
                                ) : (
                                    <MenuIcon aria-hidden className="size-5" />
                                )}
                            </IconButton>
                        </Row>
                    </div>
                </header>
                <nav
                    aria-label="Glavna navigacija"
                    className={cx(
                        'pointer-events-auto md:hidden',
                        mobileMenuOpen ? 'block' : 'hidden',
                    )}
                    id={menuId}
                    onClickCapture={handleMobileNavClick}
                >
                    <div className="mt-2 overflow-hidden rounded-2xl border border-border/70 bg-background/90 p-2 shadow-xl shadow-foreground/10 ring-1 ring-black/5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
                        <Stack spacing={1}>
                            {links?.map((item) => renderNavItem(item, true))}
                        </Stack>
                    </div>
                </nav>
            </Container>
        </div>
    );
}
