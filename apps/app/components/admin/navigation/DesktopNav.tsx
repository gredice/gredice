import { Nav } from './Nav';

export function DesktopNav() {
    return (
        <div data-gredice-admin-nav>
            <div
                className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border bg-background/95 p-3 shadow-xs"
                data-gredice-admin-nav-panel
            >
                <Nav idPrefix="desktop-admin-nav" />
            </div>
        </div>
    );
}
