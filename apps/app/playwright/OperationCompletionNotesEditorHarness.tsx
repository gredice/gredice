import { StrictMode, useState } from 'react';
import { OperationCompletionNotesEditor } from '../app/admin/schedule/OperationCompletionNotesEditor';

export function OperationCompletionNotesEditorHarness({
    edited = false,
    initialNotes = 'rajcice vrh odrezat i oprat martine',
}: {
    edited?: boolean;
    initialNotes?: string;
}) {
    const [notes, setNotes] = useState(initialNotes);
    const [open, setOpen] = useState(true);
    return (
        <StrictMode>
            <button type="button" onClick={() => setOpen(!open)}>
                Prikaži / sakrij
            </button>
            {open && (
                <OperationCompletionNotesEditor
                    operationId={5089}
                    expectedTaskVersionEventId={20}
                    notes={notes}
                    previouslyEdited={edited}
                    onChange={setNotes}
                />
            )}
        </StrictMode>
    );
}
