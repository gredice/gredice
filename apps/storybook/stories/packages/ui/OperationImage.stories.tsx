import { OperationImage } from '@gredice/ui/OperationImage';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import careCover from '../../../../www/assets/RaisedBedMaintenance.webp?url';

const meta = {
    title: 'packages/ui/Images/OperationImage',
    component: OperationImage,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Operation cover with a category fallback. Public website consumers opt into the game variant. Actual cover images take precedence for both variants; the default keeps its existing monochrome categories.',
            },
        },
    },
    args: {
        operation: {
            information: { label: 'Zalijevanje' },
            attributes: { category: { information: { name: 'watering' } } },
        },
        size: 192,
    },
} satisfies Meta<typeof OperationImage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Game: Story = { args: { variant: 'game' } };
export const UnknownCategory: Story = {
    args: { variant: 'game', operation: { information: { label: 'Radnja' } } },
};
export const CoverTakesPrecedence: Story = {
    args: {
        variant: 'game',
        operation: {
            ...meta.args.operation,
            image: { cover: { url: careCover } },
        },
    },
};
