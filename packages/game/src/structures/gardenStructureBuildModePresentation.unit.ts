import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
    GardenStructureEditorExitDecision,
    GardenStructureEditorPricingPreview,
} from './editor';
import {
    canExitGardenStructureEditorWithoutConfirmation,
    getGardenStructureExitConfirmationPresentation,
    getGardenStructurePricingPresentation,
    getGardenStructureSaveStatusLabel,
} from './gardenStructureBuildModePresentation';

function pricing({
    cellDelta,
    debit,
    refund,
}: {
    cellDelta: number;
    debit: number;
    refund: number;
}): GardenStructureEditorPricingPreview {
    return {
        cellCount: 25 + cellDelta,
        maximumCellCount: 100,
        totalPrice: (25 + cellDelta) * 50,
        delta: {
            cellDelta,
            debit,
            refund,
            nextRefundablePrincipal: 1_250 + debit - refund,
        },
    };
}

describe('garden structure build-mode presentation', () => {
    test('shows create, resize, refund, unchanged, and sandbox pricing', () => {
        assert.equal(
            getGardenStructurePricingPresentation({
                isSandbox: false,
                originKind: 'new-draft',
                pricing: pricing({ cellDelta: 25, debit: 1_250, refund: 0 }),
            }).actionLabel,
            'Za platiti 1.250 🌻',
        );
        const expansion = getGardenStructurePricingPresentation({
            isSandbox: false,
            originKind: 'saved-structure',
            pricing: pricing({ cellDelta: 2, debit: 100, refund: 0 }),
            sunflowerPricePerCell: 50,
        });
        assert.equal(expansion.actionLabel, 'Za platiti 100 🌻');
        assert.equal(expansion.rateLabel, '50 🌻 / polje');
        assert.equal(
            getGardenStructurePricingPresentation({
                isSandbox: false,
                originKind: 'saved-structure',
                pricing: pricing({ cellDelta: -2, debit: 0, refund: 100 }),
            }).actionLabel,
            'Povrat 100 🌻',
        );
        assert.equal(
            getGardenStructurePricingPresentation({
                isSandbox: false,
                originKind: 'saved-structure',
                pricing: pricing({ cellDelta: 0, debit: 0, refund: 0 }),
            }).actionLabel,
            'Bez promjene cijene',
        );
        assert.deepEqual(
            getGardenStructurePricingPresentation({
                isSandbox: true,
                originKind: 'new-draft',
                pricing: pricing({ cellDelta: 25, debit: 1_250, refund: 0 }),
            }),
            {
                actionLabel: 'Bez naplate',
                rateLabel: 'Besplatno u vrtu za igru',
            },
        );
    });

    test('does not promise recovery or allow a blockless recovery exit after a failed write', () => {
        assert.match(
            getGardenStructureSaveStatusLabel({
                originKind: 'new-draft',
                recoveryAvailability: 'unavailable',
                save: {
                    status: 'offline',
                    operation: 'create',
                    operationId: 'save-1',
                    expectedRevision: null,
                    submittedSnapshot: {
                        document: {
                            schemaVersion: 1,
                            footprint: { cells: [] },
                            floors: [],
                            edges: [],
                            roofRegions: [],
                            props: [],
                        },
                        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
                    },
                },
            }),
            /lokalna kopija nije dostupna/,
        );
        const decision: GardenStructureEditorExitDecision = {
            kind: 'local-recovery-only',
            reason: 'offline',
            serverAcknowledged: false,
        };
        assert.equal(
            canExitGardenStructureEditorWithoutConfirmation(
                decision,
                'unavailable',
            ),
            false,
        );
        assert.equal(
            canExitGardenStructureEditorWithoutConfirmation(
                decision,
                'available',
            ),
            true,
        );
        assert.deepEqual(
            getGardenStructureExitConfirmationPresentation('unavailable'),
            {
                actionLabel: 'Izađi i odbaci promjene',
                description:
                    'Lokalnu kopiju nije moguće pohraniti. Izlaskom ćete izgubiti ove promjene.',
                keepRecovery: false,
            },
        );
    });
});
