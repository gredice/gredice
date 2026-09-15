import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { OperationCompletionEvidenceEditModal } from '../app/admin/schedule/OperationCompletionEvidenceEditModal';

export function OperationCompletionEvidenceEditHarness({
    edited = false,
}: {
    edited?: boolean;
}) {
    return (
        <AppRouterContext.Provider
            value={{
                bfcacheId: 'evidence-edit',
                back() {},
                forward() {},
                refresh() {
                    document.documentElement.dataset.evidenceRefreshed = 'true';
                },
                push() {},
                replace() {},
                prefetch() {},
            }}
        >
            <OperationCompletionEvidenceEditModal
                operationId={5089}
                expectedTaskVersionEventId={20}
                label="Detaljan pregled gredice"
                initialNotes="rajcice vrh odrezat"
                completionNotesEdited={edited}
            />
        </AppRouterContext.Provider>
    );
}
