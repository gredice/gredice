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

const tools = [
    { href: '/schedule', icon: Calendar, label: 'Cijeli raspored' },
    { href: '/notifications', icon: Inbox, label: 'Obavijesti' },
    { href: '/raised-beds', icon: Fence, label: 'Gredice' },
    { href: '/greenhouse', icon: MapPinHouse, label: 'Staklenik' },
    { href: '/operations', icon: BookA, label: 'Radnje' },
    { href: '/plants', icon: Sprout, label: 'Biljke' },
    { href: '/payouts', icon: Euro, label: 'Isplate' },
];

export function FarmTodayTools() {
    return (
        <section aria-labelledby="farm-today-tools-title" className="space-y-2">
            <h2 className="text-sm font-semibold" id="farm-today-tools-title">
                Ostali alati
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tools.map(({ href, icon: Icon, label }) => (
                    <Button
                        className="justify-start px-3 text-sm"
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
