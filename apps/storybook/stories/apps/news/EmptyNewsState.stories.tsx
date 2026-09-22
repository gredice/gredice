import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EmptyNewsState } from '../../../../news/components/EmptyNewsState';

const meta = {
    title: 'apps/news/Feedback/EmptyNewsState',
    component: EmptyNewsState,
    tags: ['autodocs'],
    args: {
        title: 'Još nema novosti',
        children: 'Nove priče iz vrta stižu uskoro.',
    },
} satisfies Meta<typeof EmptyNewsState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoWeeklyUpdates: Story = {
    args: {
        title: 'Nema tjednih pregleda',
        children: 'Trenutačno nema objavljenih novosti za ovu oznaku.',
    },
};
