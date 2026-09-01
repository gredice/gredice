import {
    type GardenStructureCoordinate,
    type GardenStructureDocumentV1,
    gardenStructureCellKey,
    getGardenStructureFootprintBounds,
} from '@gredice/js/gardenStructures';
import type { GardenStructureBuildCategory } from '../../useGameState';
import { getGardenStructureDocumentFingerprint } from '../gardenStructureDocumentFingerprint';
import type { GardenStructureDocumentEditFailure } from './gardenStructureDocumentEdits';
import type {
    GardenStructureEditorFailure,
    GardenStructureEditorState,
} from './gardenStructureEditorTypes';

export const gardenStructureExistingAutosaveDelayMs = 1_500;

export type GardenStructurePropTargetAction = Readonly<{
    kind: 'duplicate' | 'move';
    propId: string;
}>;

export type GardenStructureSelectedKeyboardAction =
    | Readonly<{
          kind: 'delete-prop';
          propId: string;
      }>
    | Readonly<{
          cell: GardenStructureCoordinate;
          kind: 'remove-footprint-cell' | 'remove-roof-coverage';
      }>;

export type GardenStructureSaveIntent = 'autosave' | 'done';
export type GardenStructureSaveCompletionAction =
    | 'close'
    | 'save-current-again'
    | 'stay-open';

export function getGardenStructureSaveCompletionAction(
    editor: GardenStructureEditorState,
    intent: GardenStructureSaveIntent,
): GardenStructureSaveCompletionAction {
    if (editor.save.status === 'dirty') {
        return intent === 'done' ? 'save-current-again' : 'stay-open';
    }
    return editor.save.status === 'clean' && intent === 'done'
        ? 'close'
        : 'stay-open';
}

export function getGardenStructureExistingAutosaveKey(
    editor: GardenStructureEditorState | null | undefined,
    persistence: 'fixture' | 'remote' | null | undefined,
) {
    if (
        persistence !== 'remote' ||
        editor?.origin.kind !== 'saved-structure' ||
        editor.workflow.kind !== 'editing' ||
        editor.save.status !== 'dirty' ||
        editor.demolition.status !== 'idle'
    ) {
        return null;
    }

    const { placement } = editor.snapshot;
    return [
        editor.origin.gardenId,
        editor.origin.structureId,
        editor.origin.revision,
        getGardenStructureDocumentFingerprint(editor.snapshot.document),
        placement.anchorX,
        placement.anchorY,
        placement.rotation,
    ].join(':');
}

export function getGardenStructureExistingAutosaveScope(
    editor: GardenStructureEditorState | null | undefined,
    persistence: 'fixture' | 'remote' | null | undefined,
) {
    return persistence === 'remote' && editor?.origin.kind === 'saved-structure'
        ? `${editor.origin.gardenId.toString()}:${editor.origin.structureId}`
        : null;
}

export function getGardenStructureFootprintConfirmationSummary(
    editor: GardenStructureEditorState,
) {
    if (editor.workflow.kind !== 'confirming-footprint') {
        return null;
    }
    const { change } = editor.workflow;
    const bounds = getGardenStructureFootprintBounds(
        change.command.after.document.footprint.cells,
    );
    if (!bounds) {
        return null;
    }
    const rotated = change.command.after.placement.rotation % 2 === 1;
    return {
        depth: rotated ? bounds.width : bounds.depth,
        pricing: change.pricing,
        width: rotated ? bounds.depth : bounds.width,
    };
}

function selectedFootprintCell(
    document: GardenStructureDocumentV1,
    selectedCellKey: string | null,
) {
    return selectedCellKey
        ? document.footprint.cells.find(
              (cell) => gardenStructureCellKey(cell) === selectedCellKey,
          )
        : undefined;
}

export function getGardenStructureSelectedKeyboardAction({
    category,
    document,
    propTargetAction,
    selectedCellKey,
}: {
    category: GardenStructureBuildCategory;
    document: GardenStructureDocumentV1;
    propTargetAction: GardenStructurePropTargetAction | null;
    selectedCellKey: string | null;
}): GardenStructureSelectedKeyboardAction | null {
    if (propTargetAction) {
        return null;
    }
    const cell = selectedFootprintCell(document, selectedCellKey);
    if (!cell) {
        return null;
    }
    const coordinate = { x: cell.x, y: cell.y };
    switch (category) {
        case 'footprint':
            return { cell: coordinate, kind: 'remove-footprint-cell' };
        case 'roof':
            return document.roofRegions.some((region) =>
                region.cells.some(
                    (candidate) =>
                        gardenStructureCellKey(candidate) === selectedCellKey,
                ),
            )
                ? { cell: coordinate, kind: 'remove-roof-coverage' }
                : null;
        case 'interior': {
            const props = document.props.filter(
                (prop) => prop.x === cell.x && prop.y === cell.y,
            );
            return props.length === 1 && props[0]
                ? { kind: 'delete-prop', propId: props[0].id }
                : null;
        }
        case 'structure':
            return null;
    }
}

export function getGardenStructureDocumentEditErrorMessage(
    error: GardenStructureDocumentEditFailure,
) {
    const messages: Readonly<
        Record<GardenStructureDocumentEditFailure['reason'], string>
    > = {
        'cell-not-found': 'Odabrano polje više nije dio tlocrta.',
        'id-exhausted': 'Nije moguće dodijeliti novi sigurni identifikator.',
        'invalid-document': 'Trenutačni nacrt građevine nije valjan.',
        'invalid-result': 'Ta bi izmjena stvorila nevaljan nacrt građevine.',
        'invalid-target': 'Odabrano ciljno polje nije valjano.',
        'item-not-found': 'Odabrani dio građevine više ne postoji.',
        'limit-exceeded': 'Dosegnuto je ograničenje dijelova građevine.',
        'no-change': 'Odabrana radnja ne mijenja građevinu.',
        overlap: 'Na ciljanom polju već postoji dio koji se preklapa.',
        'unsupported-kit': 'Ova verzija građevinskog kompleta nije dostupna.',
        'unsupported-reference':
            'Odabrani dio nije dostupan u ovoj verziji kompleta.',
    };
    return messages[error.reason];
}

export function getGardenStructureEditorActionErrorMessage(
    error: GardenStructureEditorFailure,
) {
    switch (error.code) {
        case 'no-change':
            return 'Odabrana radnja ne mijenja građevinu.';
        case 'footprint-confirmation-required':
            return 'Najprije potvrdite ili otkažite promjenu tlocrta.';
        case 'invalid-snapshot':
            return 'Ta promjena nije dopuštena za ovaj tlocrt.';
        case 'invalid-state':
            return 'Pričekajte završetak trenutačne radnje.';
        default:
            return 'Promjenu građevine nije moguće primijeniti.';
    }
}
