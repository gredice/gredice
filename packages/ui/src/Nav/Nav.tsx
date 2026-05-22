import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { Button } from '../Button';
import { Container } from '../Container';
import { Menu as MenuIcon } from '../icons';
import { Link } from '../Link';
import { Row } from '../Row';
import { Stack } from '../Stack';

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
    return (
        <div>
            <input
                aria-label="Toggle menu"
                className="peer hidden"
                id="mobile-menu-toggle"
                type="checkbox"
            />
            <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center border-b border-muted/30 backdrop-blur-md transition-all peer-checked:border-border peer-checked:bg-card">
                <Container>
                    <Row justifyContent="space-between">
                        <div className="flex h-full flex-col items-center">
                            <Link href="/">{logo}</Link>
                        </div>
                        <Row spacing={0}>
                            <nav className="hidden md:block">
                                <Row spacing={0}>
                                    {links?.map((item) => renderNavItem(item))}
                                </Row>
                            </nav>
                            <label
                                className="block md:hidden"
                                htmlFor="mobile-menu-toggle"
                            >
                                <MenuIcon aria-hidden className="size-6" />
                            </label>
                            {children && <div className="ml-2">{children}</div>}
                        </Row>
                    </Row>
                </Container>
            </header>
            <nav className="hidden peer-checked:block md:hidden">
                <div className="fixed inset-x-2 top-16 z-10 mt-2 rounded-lg border bg-card shadow-lg animate-in fade-in slide-in-from-top-2">
                    <Stack>
                        {links?.map((item) => renderNavItem(item, true))}
                    </Stack>
                </div>
            </nav>
        </div>
    );
}
