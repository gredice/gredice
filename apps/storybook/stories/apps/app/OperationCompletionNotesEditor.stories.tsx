import { OperationCompletionNotesEditor } from '@apps/app/app/admin/schedule/OperationCompletionNotesEditor';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

const suggestedNote =
    'Na plodovima rajčice uočeni su smrdljivi martini.\n\nPredlažemo:\n- uklanjanje vrhova rajčica i ispiranje zahvaćenih plodova;\n- sanitarnu rezidbu krastavaca;\n- uklanjanje blitve i korova.';

const meta = {
    title: 'App/Schedule/OperationCompletionNotesEditor',
    component: OperationCompletionNotesEditor,
    parameters: { layout: 'padded' },
    args: {
        operationId: 5089,
        expectedTaskVersionEventId: 20,
        notes: 'Preporuka dekapitacije rajcica i ispiranje od stetnika (smrdljivi martini po plodovima)\nSanitarna rezidba krastavaca\nUklanjanje blitve\nUklanjanje korova',
        requestSuggestion: async (): Promise<string | null> => suggestedNote,
        onChange: () => {},
    },
    render: function Editor(args) {
        const [notes, setNotes] = useState(args.notes);
        return (
            <div className="max-w-xl">
                <OperationCompletionNotesEditor
                    {...args}
                    notes={notes}
                    onChange={setNotes}
                />
            </div>
        );
    },
} satisfies Meta<typeof OperationCompletionNotesEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suggested: Story = {};
export const PreviouslyEdited: Story = {
    args: { previouslyEdited: true, notes: suggestedNote },
};
export const Empty: Story = { args: { notes: '' } };
export const Loading: Story = {
    args: { requestSuggestion: () => new Promise(() => {}) },
};
export const Unavailable: Story = {
    args: {
        requestSuggestion: async () => {
            throw new Error(
                'Prijedlog trenutačno nije dostupan. Pokušajte ponovno.',
            );
        },
    },
};
