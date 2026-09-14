import { Tabs, TabsContent } from '@gredice/ui/Tabs';
import { RaisedBedDetailsTabsList } from '@packages/game/hud/raisedBed/RaisedBedDetailsTabsList';

const groups = [
    { view: 'bed', title: 'Gredica', defaultValue: 'diary' },
    { view: 'plant', title: 'Biljka', defaultValue: 'lifecycle' },
    {
        view: 'historical',
        title: 'Prethodna biljka',
        defaultValue: 'lifecycle',
    },
];

export function GameIconGroups() {
    return (
        <section aria-label="Icons used together" className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">Icons used together</h2>
                <p className="text-sm text-muted-foreground">
                    The actual bed and plant navigation, including the
                    historical plant view with no available actions.
                </p>
            </div>
            {groups.map(({ view, title, defaultValue }) => (
                <section
                    key={view}
                    aria-label={title}
                    data-icon-group={view}
                    className="min-w-0 space-y-3"
                >
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <Tabs defaultValue={defaultValue} className="flex flex-col">
                        <RaisedBedDetailsTabsList
                            view={view === 'bed' ? 'bed' : 'plant'}
                            showOperations={view !== 'historical'}
                        />
                        {view !== 'bed' && (
                            <TabsContent value="lifecycle" className="text-sm">
                                Rajčica ·{' '}
                                {view === 'historical' ? 'Ubrano' : 'Raste'}
                            </TabsContent>
                        )}
                        <TabsContent value="diary" className="text-sm">
                            Zalijevanje · 8. rujna 2026.
                        </TabsContent>
                        {view !== 'historical' && (
                            <TabsContent value="operations" className="text-sm">
                                Dostupne radnje: zalijevanje i fotografiranje.
                            </TabsContent>
                        )}
                        {view === 'bed' && (
                            <TabsContent value="info" className="text-sm">
                                Gredica A12 · 4 polja
                            </TabsContent>
                        )}
                    </Tabs>
                </section>
            ))}
        </section>
    );
}
