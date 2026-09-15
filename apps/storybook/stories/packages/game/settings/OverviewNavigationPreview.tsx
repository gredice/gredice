import { OverviewNavigation } from '@packages/game/modals/OverviewNavigation';
import { overviewNavItems } from '@packages/game/modals/overviewNavigationItems';
import { useState } from 'react';

export function OverviewNavigationPreview() {
    const [value, setValue] = useState('generalno');
    const selectedItem = overviewNavItems.find((item) => item.value === value);

    return (
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[260px_1fr]">
            <div className="md:border-r">
                <OverviewNavigation value={value} onValueChange={setValue} />
            </div>
            <section aria-label="Pregled ikona" className="space-y-6">
                <h1 className="flex items-center gap-2 text-xl font-semibold">
                    {selectedItem?.icon}
                    {selectedItem?.label}
                </h1>
                <p className="text-sm text-foreground">
                    Ikone odjeljaka profila i postavki, u veličini koja se
                    koristi u igri. Izbornik je moguće pretražiti i odabrati
                    odjeljak.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    {overviewNavItems.map((item) => (
                        <div
                            key={item.value}
                            className="flex items-center gap-2"
                        >
                            {item.icon}
                            <span className="text-sm">{item.label}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
