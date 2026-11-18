import { Nav } from './Nav';

export function DesktopNav() {
    return (
        // Extends into the side panel gap so the borderless nav sits closer to the content.
        <div className="md:-mr-3" data-gredice-admin-nav>
            {/* p-1 keeps focus rings visible inside the scroll container. */}
            <div
                className="max-h-[calc(100vh-2rem)] overflow-y-auto p-1"
                data-gredice-admin-nav-panel
            >
                <Nav idPrefix="desktop-admin-nav" />
            </div>
        </div>
    );
}
