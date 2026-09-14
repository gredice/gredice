import { AnchorPrice } from '@gredice/ui/AnchorPrice';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/AnchorPrice',
    component: AnchorPrice,
    tags: ['autodocs'],
    args: { currentPrice: 5, anchor: { price: 5, date: '2026-09-10' } },
    decorators: [
        (Story, context) => (
            <div className="max-w-xs rounded-lg border p-4 text-right">
                <span className="font-semibold">
                    {context.args.currentPrice?.toFixed(2)} €
                </span>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof AnchorPrice>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Unchanged: Story = {};
export const Increased: Story = { args: { currentPrice: 7 } };
export const Decreased: Story = { args: { currentPrice: 4 } };
export const MissingHistory: Story = { args: { anchor: null } };
export const FoodReferenceDate: Story = {
    args: { anchor: { price: 3, date: '2025-05-02' } },
};
