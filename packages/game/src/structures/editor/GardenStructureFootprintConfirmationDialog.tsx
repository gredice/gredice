'use client';

import { gardenStructureMaxSideLength } from '@gredice/js/gardenStructures';
import { GardenStructureConfirmationDialog } from '../GardenStructureConfirmationDialog';
import type { GardenStructureEditorPricingPreview } from './gardenStructureEditorTypes';

export function GardenStructureFootprintConfirmationDialog({
    depth,
    error,
    isSandbox,
    onCancel,
    onConfirm,
    pricing,
    width,
}: {
    depth: number;
    error?: string | null;
    isSandbox: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    pricing: GardenStructureEditorPricingPreview;
    width: number;
}) {
    return (
        <GardenStructureConfirmationDialog
            cancelLabel="Vrati tlocrt"
            confirmLabel="Potvrdi promjenu"
            description="Promjena veličine utječe na položaj i vrijednost građevine. Provjerite točne iznose prije potvrde."
            details={
                <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-3">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-foreground">
                        <dt>Iskorišteno</dt>
                        <dd className="text-right font-semibold">
                            {pricing.cellCount.toLocaleString('hr-HR')} /{' '}
                            {pricing.maximumCellCount.toLocaleString('hr-HR')}
                        </dd>
                        <dt>Dimenzije</dt>
                        <dd className="text-right font-semibold">
                            {width.toLocaleString('hr-HR')} ×{' '}
                            {depth.toLocaleString('hr-HR')} /{' '}
                            {gardenStructureMaxSideLength.toLocaleString(
                                'hr-HR',
                            )}
                        </dd>
                        <dt>Ukupna vrijednost</dt>
                        <dd className="text-right font-semibold">
                            {pricing.totalPrice.toLocaleString('hr-HR')} 🌻
                        </dd>
                        <dt>Dodatna naplata</dt>
                        <dd className="text-right font-semibold">
                            {pricing.delta.debit.toLocaleString('hr-HR')} 🌻
                        </dd>
                        <dt>Povrat</dt>
                        <dd className="text-right font-semibold">
                            {pricing.delta.refund.toLocaleString('hr-HR')} 🌻
                        </dd>
                    </dl>
                    {isSandbox ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                            U vrtu za igru promjena je bez naplate.
                        </p>
                    ) : null}
                </div>
            }
            error={error}
            onCancel={onCancel}
            onConfirm={onConfirm}
            testId="garden-structure-footprint-confirmation"
            title="Potvrditi promjenu tlocrta?"
        />
    );
}
