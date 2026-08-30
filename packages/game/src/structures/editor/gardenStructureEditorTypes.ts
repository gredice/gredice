import type {
    GardenStructureDocumentV1,
    GardenStructureFootprintCell,
    GardenStructurePlacement,
    GardenStructurePriceDelta,
    GardenStructureTemplateKey,
    GardenStructureValidationIssue,
} from '@gredice/js/gardenStructures';

export type GardenStructureEditorSnapshot = Readonly<{
    document: GardenStructureDocumentV1;
    placement: GardenStructurePlacement;
}>;

export type GardenStructureEditorOrigin =
    | Readonly<{
          kind: 'new-draft';
          gardenId: number;
          draftId: string;
          templateKey: GardenStructureTemplateKey;
          kitKey: string;
          kitVersion: string;
      }>
    | Readonly<{
          kind: 'saved-structure';
          gardenId: number;
          structureId: string;
          templateKey: GardenStructureTemplateKey;
          kitKey: string;
          kitVersion: string;
          revision: number;
          sunflowerPricePerCell: number;
          refundablePrincipal: number;
          acknowledged: GardenStructureEditorSnapshot;
      }>;

export type GardenStructureEditorTool =
    | 'select'
    | 'footprint'
    | 'shell'
    | 'openings'
    | 'roof'
    | 'interior'
    | 'hand';

export type GardenStructureEditorCommandKind =
    | 'document-edit'
    | 'placement-edit'
    | 'footprint-paint';

export type GardenStructureEditorCommand = Readonly<{
    id: string;
    kind: GardenStructureEditorCommandKind;
    before: GardenStructureEditorSnapshot;
    after: GardenStructureEditorSnapshot;
    byteLength: number;
}>;

export type GardenStructureEditorHistory = Readonly<{
    past: readonly GardenStructureEditorCommand[];
    future: readonly GardenStructureEditorCommand[];
    totalBytes: number;
}>;

export type GardenStructureEditorPricingPreview = Readonly<{
    cellCount: number;
    maximumCellCount: number;
    totalPrice: number;
    delta: GardenStructurePriceDelta;
}>;

export type GardenStructureStagedFootprintChange = Readonly<{
    command: GardenStructureEditorCommand;
    pricing: GardenStructureEditorPricingPreview;
}>;

export type GardenStructureEditorResizeConfirmation = Readonly<{
    baseRevision: number;
    footprintFingerprint: string;
    pricing: GardenStructureEditorPricingPreview;
}>;

export type GardenStructureEditorWorkflow =
    | Readonly<{ kind: 'placing-template' }>
    | Readonly<{
          kind: 'editing';
          tool: GardenStructureEditorTool;
      }>
    | Readonly<{
          kind: 'confirming-footprint';
          returnTo: GardenStructureEditorTool;
          change: GardenStructureStagedFootprintChange;
      }>
    | Readonly<{
          kind: 'asset-error';
          code: string;
          returnTo:
              | Readonly<{ kind: 'placing-template' }>
              | Readonly<{
                    kind: 'editing';
                    tool: GardenStructureEditorTool;
                }>;
      }>;

export type GardenStructureEditorSaveOperation =
    | 'create'
    | 'replace-document'
    | 'resize'
    | 'placement';

export type GardenStructureEditorSaveState =
    | Readonly<{ status: 'clean' }>
    | Readonly<{ status: 'dirty' }>
    | Readonly<{
          status: 'saving';
          operation: GardenStructureEditorSaveOperation;
          operationId: string;
          expectedRevision: number | null;
          submittedSnapshot: GardenStructureEditorSnapshot;
      }>
    | Readonly<{
          status: 'offline';
          operation: GardenStructureEditorSaveOperation;
          operationId: string;
          expectedRevision: number | null;
          submittedSnapshot: GardenStructureEditorSnapshot;
      }>
    | Readonly<{
          status: 'conflict';
          operation: Exclude<GardenStructureEditorSaveOperation, 'create'>;
          operationId: string;
          expectedRevision: number;
          actualRevision: number | null;
          submittedSnapshot: GardenStructureEditorSnapshot;
      }>
    | Readonly<{
          status: 'error';
          code: string;
          outcome: 'rejected' | 'unknown';
          operation: GardenStructureEditorSaveOperation;
          operationId: string | null;
          expectedRevision: number | null;
          submittedSnapshot: GardenStructureEditorSnapshot | null;
      }>;

export type GardenStructureEditorState = Readonly<{
    origin: GardenStructureEditorOrigin;
    snapshot: GardenStructureEditorSnapshot;
    workflow: GardenStructureEditorWorkflow;
    save: GardenStructureEditorSaveState;
    history: GardenStructureEditorHistory;
    resizeConfirmation: GardenStructureEditorResizeConfirmation | null;
}>;

export type GardenStructureEditorFootprintPaintOperation =
    | Readonly<{
          kind: 'add';
          cell: GardenStructureFootprintCell;
      }>
    | Readonly<{
          kind: 'remove';
          cell: Readonly<{ x: number; y: number }>;
      }>;

export type GardenStructureEditorFailureCode =
    | 'duplicate-command-id'
    | 'footprint-confirmation-required'
    | 'history-diverged'
    | 'history-entry-too-large'
    | 'invalid-command-id'
    | 'invalid-recovery'
    | 'invalid-save-acknowledgement'
    | 'invalid-snapshot'
    | 'invalid-state'
    | 'no-change'
    | 'nothing-to-recover'
    | 'operation-mismatch'
    | 'recovery-too-large'
    | 'unsupported-recovery-version';

export type GardenStructureEditorFailure = Readonly<{
    code: GardenStructureEditorFailureCode;
    message: string;
    issues?: readonly GardenStructureValidationIssue[];
}>;

export type GardenStructureEditorResult<Value> =
    | Readonly<{ ok: true; value: Value }>
    | Readonly<{ ok: false; error: GardenStructureEditorFailure }>;

export type GardenStructureEditorExitDecision =
    | Readonly<{
          kind: 'exit-safe';
          serverAcknowledged: true;
      }>
    | Readonly<{
          kind: 'discard-unplaced-draft';
          serverAcknowledged: false;
      }>
    | Readonly<{
          kind: 'confirm-footprint-first';
          serverAcknowledged: false;
      }>
    | Readonly<{
          kind: 'save-required';
          operation: GardenStructureEditorSaveOperation;
          serverAcknowledged: false;
      }>
    | Readonly<{
          kind: 'wait-for-save';
          serverAcknowledged: false;
      }>
    | Readonly<{
          kind: 'resolve-conflict';
          serverAcknowledged: false;
      }>
    | Readonly<{
          kind: 'local-recovery-only';
          reason: 'offline' | 'error';
          serverAcknowledged: false;
      }>;

export type GardenStructureEditorSaveAcknowledgement = Readonly<{
    operationId: string;
    structureId: string;
    templateKey: GardenStructureTemplateKey;
    kitKey: string;
    kitVersion: string;
    revision: number;
    sunflowerPricePerCell: number;
    refundablePrincipal: number;
    snapshot: GardenStructureEditorSnapshot;
}>;
