import { EditableInput } from '@gredice/ui/EditableInput';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ComponentProps, useState } from 'react';

const meta = {
    title: 'packages/ui/Forms/EditableInput',
    component: EditableInput,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'EditableInput provides inline text editing for compact labels such as raised-bed names.',
            },
        },
    },
    args: {
        onChange: () => {},
        value: 'Gredica s rajcicama',
    },
    render: (args) => <ControlledEditableInput {...args} />,
} satisfies Meta<typeof EditableInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Constrained: Story = {
    render: (args) => (
        <div className="w-72 rounded-lg border bg-card p-4">
            <ControlledEditableInput {...args} />
        </div>
    ),
};

function ControlledEditableInput(args: ComponentProps<typeof EditableInput>) {
    const [value, setValue] = useState(args.value);

    return <EditableInput {...args} value={value} onChange={setValue} />;
}
