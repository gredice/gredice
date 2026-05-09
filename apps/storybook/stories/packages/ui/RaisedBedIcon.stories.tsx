import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Icons/RaisedBedIcon',
    component: RaisedBedIcon,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'RaisedBedIcon visualizes a raised garden bed and can include a physical bed identifier when one is available.',
            },
        },
    },
    args: {
        className: 'text-primary',
        physicalId: 'A12',
    },
} satisfies Meta<typeof RaisedBedIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithIdentifier: Story = {};

export const IconOnly: Story = {
    args: {
        className: 'size-10 text-primary',
        physicalId: null,
    },
};
