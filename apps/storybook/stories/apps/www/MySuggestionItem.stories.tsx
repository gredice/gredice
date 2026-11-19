import { MySuggestionItem } from '@apps/www/app/moji-prijedlozi/MySuggestionItem';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Community/MySuggestionItem',
    component: MySuggestionItem,
    tags: ['autodocs'],
    args: {
        item: {
            id: 14,
            status: 'pending',
            kind: 'edit',
            title: 'Rajčica',
            context: 'Sijanje',
            publicPath: '/biljke/rajcica',
            changeLabels: ['Opis faze', 'Dubina sijanja'],
            submitterMessage: null,
            createdAt: '2026-11-19T09:00:00.000Z',
            reviewedAt: null,
            appliedAt: null,
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[640px] max-w-full">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof MySuggestionItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InReview: Story = {};

export const Published: Story = {
    args: {
        item: {
            ...meta.args.item,
            status: 'applied',
            title: 'Mrkva',
            context: 'Biljni susjedi',
            publicPath: '/biljke/mrkva',
            changeLabels: ['Dobri susjedi'],
            submitterMessage: 'Hvala, dodali smo i luk.',
            reviewedAt: '2026-11-20T09:00:00.000Z',
            appliedAt: '2026-11-20T09:00:00.000Z',
        },
    },
};

export const NotAccepted: Story = {
    args: {
        item: {
            ...meta.args.item,
            status: 'rejected',
            kind: 'suggestion',
            title: 'Blitva rubin',
            context: 'Nova sorta · Blitva',
            publicPath: '/biljke/blitva',
            changeLabels: [],
            submitterMessage: 'Ta sorta već postoji pod drugim nazivom.',
            reviewedAt: '2026-11-20T09:00:00.000Z',
        },
    },
};

export const NeedsRefresh: Story = {
    args: {
        item: {
            ...meta.args.item,
            status: 'conflicted',
            title: 'Paprika',
            context: 'Berba',
            publicPath: '/biljke/paprika',
            changeLabels: ['Berba'],
            reviewedAt: '2026-11-20T09:00:00.000Z',
        },
    },
};

export const Canceled: Story = {
    args: { item: { ...meta.args.item, status: 'canceled', context: null } },
};
