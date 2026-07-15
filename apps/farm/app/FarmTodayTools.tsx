import { Button } from '@gredice/ui/Button';
import {
    BookA,
    Calendar,
    Euro,
    Fence,
    Inbox,
    MapPinHouse,
    Sprout,
} from '@gredice/ui/icons';
import type { FarmNavigationDestination } from '../components/analytics/farmAnalytics';

const tools = [
    {
        destination: 'schedule',
        href: '/schedule',
        icon: Calendar,
        label: 'Cijeli raspored',
    },
    {
        destination: 'notifications',
        href: '/notifications',
        icon: Inbox,
        label: 'Obavijesti',
    },
    {
        destination: 'raised_beds',
        href: '/raised-beds',
        icon: Fence,
        label: 'Gredice',
    },
    {
        destination: 'greenhouse',
        href: '/greenhouse',
        icon: MapPinHouse,
        label: 'Staklenik',
    },
    {
        destination: 'operations',
        href: '/operations',
        icon: BookA,
        label: 'Radnje',
    },
    {
        destination: 'plants',
        href: '/plants',
        icon: Sprout,
        label: 'Biljke',
    },
    {
        destination: 'payouts',
        href: '/payouts',
        icon: Euro,
        label: 'Isplate',
    },
] satisfies {
    destination: FarmNavigationDestination;
    href: string;
    icon: typeof Calendar;
    label: string;
}[];

export function FarmTodayTools() {
    return (
        <section aria-labelledby="farm-today-tools-title" className="space-y-2">
            <h2 className="text-sm font-semibold" id="farm-today-tools-title">
                Ostali alati
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tools.map(({ destination, href, icon: Icon, label }) => (
                    <Button
                        className="justify-start px-3 text-sm"
                        data-farm-analytics="navigation"
                        data-farm-navigation-destination={destination}
                        data-farm-navigation-source="today_tools"
                        fullWidth
                        href={href}
                        key={href}
                        size="lg"
                        startDecorator={<Icon aria-hidden className="size-4" />}
                        variant="outlined"
                    >
                        {label}
                    </Button>
                ))}
            </div>
        </section>
    );
}
