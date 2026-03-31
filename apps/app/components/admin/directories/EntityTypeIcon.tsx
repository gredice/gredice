import {
    Binary,
    Book,
    BookA,
    Calendar,
    Code,
    Euro,
    Fence,
    File,
    FileText,
    Ghost,
    Globe,
    Hammer,
    Hash,
    Home,
    Inbox,
    Info,
    Leaf,
    Mail,
    Map as MapIcon,
    MapPin,
    Megaphone,
    Settings,
    ShoppingCart,
    Sprout,
    Store,
    Tally3,
    Truck,
    User,
} from '@signalco/ui-icons';
import type { ComponentType, SVGProps } from 'react';

const iconMap: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
    Binary,
    Book,
    BookA,
    Calendar,
    Code,
    Euro,
    Fence,
    File,
    FileText,
    Ghost,
    Globe,
    Hammer,
    Hash,
    Home,
    Inbox,
    Info,
    Leaf,
    Mail,
    Map: MapIcon,
    MapPin,
    Megaphone,
    Settings,
    ShoppingCart,
    Sprout,
    Store,
    Tally3,
    Truck,
    User,
};

export const availableIcons = Object.keys(iconMap);

export function EntityTypeIcon({
    icon,
    className,
}: {
    icon: string | null | undefined;
    className?: string;
}) {
    const Icon = (icon ? iconMap[icon] : null) ?? File;
    return <Icon className={className} />;
}
