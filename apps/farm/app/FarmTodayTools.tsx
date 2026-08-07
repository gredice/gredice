import { Button } from '@gredice/ui/Button';
import { BookA, Euro, Sprout } from '@gredice/ui/icons';
import type { FarmNavigationDestination } from '../components/analytics/farmAnalytics';

const tools = [
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
    icon: typeof BookA;
    label: string;
}[];

export function FarmTodayTools() {
    return (
        <nav aria-label="Ostale stranice">
            <div className="grid grid-cols-3 gap-2">
                {tools.map(({ destination, href, icon: Icon, label }) => (
                    <Button
                        className="justify-center px-2 text-sm"
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
        </nav>
    );
}
