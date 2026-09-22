import { OperationRequestNote } from '@gredice/ui/OperationRequestNote';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Content/OperationRequestNote',
    component: OperationRequestNote,
    tags: ['autodocs'],
    args: { note: 'Molim zalijte uz korijen.\nSačuvajte zdrave listove.' },
    decorators: [
        (Story) => (
            <div className="max-w-sm">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof OperationRequestNote>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { note: null } };
export const LongNote: Story = {
    args: { note: 'Molim provjerite listove. '.repeat(20) },
};
export const UnbrokenText: Story = { args: { note: 'gredica'.repeat(70) } };
