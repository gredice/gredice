import { cx } from '@gredice/ui/utils';
import type { GardenStructureRecoveryAvailability } from './gardenStructureBuildModePresentation';

const conflictActionClassName =
    'min-h-11 rounded-xl border border-amber-700/50 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-amber-900';

export function GardenStructureConflictResolutionPanel({
    onReloadLatest,
    onSaveAsNewDraft,
    pendingAction,
    recoveryAvailability,
}: {
    onReloadLatest: () => void;
    onSaveAsNewDraft: () => void;
    pendingAction: 'reload' | 'save-as-draft' | null;
    recoveryAvailability: GardenStructureRecoveryAvailability;
}) {
    return (
        <div
            className="mt-3 rounded-xl border border-amber-600/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50"
            role="alert"
        >
            <p className="font-semibold">
                Građevina je promijenjena na drugom uređaju.
            </p>
            <p className="mt-1 text-xs">
                {recoveryAvailability === 'available'
                    ? 'Lokalne izmjene sigurno su pohranjene na ovom uređaju.'
                    : recoveryAvailability === 'unavailable'
                      ? 'Lokalne izmjene nije moguće pohraniti na ovom uređaju. Nemojte zatvarati vrt dok ne odaberete rješenje.'
                      : 'Provjera lokalne kopije je u tijeku. Nemojte zatvarati vrt dok se status ne potvrdi.'}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                    type="button"
                    className={conflictActionClassName}
                    data-testid="garden-structure-conflict-reload"
                    disabled={pendingAction !== null}
                    onClick={onReloadLatest}
                >
                    {pendingAction === 'reload'
                        ? 'Učitavanje…'
                        : 'Učitaj najnovije'}
                </button>
                <p className="text-xs">
                    Odbacuje lokalne izmjene i učitava najnoviju poslužiteljsku
                    verziju, uključujući njezin položaj i važeću cijenu.
                </p>
                <button
                    type="button"
                    className={cx(
                        conflictActionClassName,
                        'border-green-700/50',
                    )}
                    data-testid="garden-structure-conflict-save-draft"
                    disabled={pendingAction !== null}
                    onClick={onSaveAsNewDraft}
                >
                    {pendingAction === 'save-as-draft'
                        ? 'Spremanje nacrta…'
                        : 'Spremi kao novi lokalni nacrt'}
                </button>
                <p className="text-xs">
                    Zadržava lokalni izgled i položaj kao novu građevinu. Pri
                    kasnijem spremanju naplaćuje se puna cijena, a položaj se
                    ponovno provjerava.
                </p>
            </div>
        </div>
    );
}
