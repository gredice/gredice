import { gardenStructureSunflowerPricePerCell } from '@gredice/js/gardenStructures';
import type {
    GardenStructureEditorExitDecision,
    GardenStructureEditorPricingPreview,
    GardenStructureEditorSaveState,
} from './editor';

export type GardenStructureRecoveryAvailability =
    | 'checking'
    | 'available'
    | 'unavailable';

export function getGardenStructureSaveStatusLabel({
    originKind,
    recoveryAvailability,
    save,
}: {
    originKind: 'new-draft' | 'saved-structure';
    recoveryAvailability: GardenStructureRecoveryAvailability;
    save: GardenStructureEditorSaveState;
}) {
    const recoverySuffix =
        recoveryAvailability === 'available'
            ? 'lokalna kopija pohranjena na uređaju'
            : recoveryAvailability === 'unavailable'
              ? 'lokalna kopija nije dostupna'
              : 'provjera lokalne kopije';

    switch (save.status) {
        case 'clean':
            return 'Spremljeno';
        case 'dirty':
            return originKind === 'new-draft'
                ? `Lokalni nacrt · ${recoverySuffix}`
                : `Nespremljene promjene · ${recoverySuffix}`;
        case 'saving':
            return 'Spremanje…';
        case 'offline':
            return `Izvan mreže · ${recoverySuffix}`;
        case 'conflict':
            return `Sukob revizije · ${recoverySuffix}`;
        case 'error':
            return save.outcome === 'unknown'
                ? `Ishod spremanja nije poznat · ${recoverySuffix}`
                : `Spremanje nije uspjelo · ${recoverySuffix}`;
    }
}

export function canExitGardenStructureEditorWithoutConfirmation(
    decision: GardenStructureEditorExitDecision,
    recoveryAvailability: GardenStructureRecoveryAvailability,
) {
    switch (decision.kind) {
        case 'exit-safe':
        case 'discard-unplaced-draft':
            return true;
        case 'local-recovery-only':
        case 'resolve-conflict':
            return recoveryAvailability === 'available';
        case 'confirm-footprint-first':
        case 'save-required':
        case 'wait-for-save':
            return false;
    }
}

export function getGardenStructureExitConfirmationPresentation(
    recoveryAvailability: GardenStructureRecoveryAvailability,
) {
    if (recoveryAvailability === 'available') {
        return {
            actionLabel: 'Izađi uz lokalni nacrt',
            description:
                'Nacrt ostaje na ovom uređaju dok spremanje nije potvrđeno.',
            keepRecovery: true,
        } as const;
    }
    return {
        actionLabel: 'Izađi i odbaci promjene',
        description:
            recoveryAvailability === 'unavailable'
                ? 'Lokalnu kopiju nije moguće pohraniti. Izlaskom ćete izgubiti ove promjene.'
                : 'Lokalna kopija još nije potvrđena. Izlaskom možete izgubiti ove promjene.',
        keepRecovery: false,
    } as const;
}

export function getGardenStructurePricingPresentation({
    isSandbox,
    originKind,
    pricing,
    sunflowerPricePerCell = gardenStructureSunflowerPricePerCell,
}: {
    isSandbox: boolean;
    originKind: 'new-draft' | 'saved-structure';
    pricing: GardenStructureEditorPricingPreview;
    sunflowerPricePerCell?: number;
}) {
    if (isSandbox) {
        return {
            actionLabel: 'Bez naplate',
            rateLabel: 'Besplatno u vrtu za igru',
        } as const;
    }

    const rateLabel = `${sunflowerPricePerCell.toLocaleString('hr-HR')} 🌻 / polje`;
    if (originKind === 'new-draft') {
        return {
            actionLabel: `Za platiti ${pricing.delta.debit.toLocaleString('hr-HR')} 🌻`,
            rateLabel,
        } as const;
    }
    if (pricing.delta.debit > 0) {
        return {
            actionLabel: `Za platiti ${pricing.delta.debit.toLocaleString('hr-HR')} 🌻`,
            rateLabel,
        } as const;
    }
    if (pricing.delta.refund > 0) {
        return {
            actionLabel: `Povrat ${pricing.delta.refund.toLocaleString('hr-HR')} 🌻`,
            rateLabel,
        } as const;
    }
    if (pricing.delta.cellDelta < 0) {
        return { actionLabel: 'Bez povrata', rateLabel } as const;
    }
    return { actionLabel: 'Bez promjene cijene', rateLabel } as const;
}
