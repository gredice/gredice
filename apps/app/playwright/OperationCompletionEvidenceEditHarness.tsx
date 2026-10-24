import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { OperationDescriptionCard } from '../app/admin/operations/OperationDescriptionCard';
import { OperationCompletionEvidenceEditModal } from '../app/admin/schedule/OperationCompletionEvidenceEditModal';

export function OperationCompletionEvidenceEditHarness({
    edited = false,
    verified = false,
    administration = false,
}: {
    edited?: boolean;
    verified?: boolean;
    administration?: boolean;
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
            {administration ? (
                <OperationDescriptionCard
                    description="Beremo samo zrele plodove biljke."
                    label="Branje zrelih plodova"
                    operationId={5089}
                    taskVersionEventId={20}
                    completionNotes="rajcice vrh odrezat"
                    completionNotesEdited
                    imageUrls={['https://cdn.gredice.com/verified-photo.jpg']}
                />
            ) : (
                <OperationCompletionEvidenceEditModal
                    operationId={5089}
                    expectedTaskVersionEventId={20}
                    label="Detaljan pregled gredice"
                    initialNotes="rajcice vrh odrezat"
                    completionNotesEdited={edited}
                    notesOnly={verified}
                    initialImageUrls={
                        verified
                            ? ['https://cdn.gredice.com/verified-photo.jpg']
                            : []
                    }
                />
            )}
        </AppRouterContext.Provider>
    );
}
