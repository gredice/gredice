import { CommunitySuggestionCard } from '@apps/www/components/community-edits/CommunitySuggestionCard';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Community/CommunitySuggestionCard',
    component: CommunitySuggestionCard,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The one look for suggesting something that is missing. It sits as the last cell of the grid it extends.',
            },
        },
    },
    args: {
        title: 'Nedostaje sorta?',
        helper: 'Predloži novu sortu za naš popis.',
    },
    decorators: [
        (Story) => (
            <div className="w-80 max-w-full">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof CommunitySuggestionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
    args: { title: 'Predloži pogođenu biljku', helper: undefined },
};

export const LongContent: Story = {
    args: {
        title: 'Nedostaje radnja za pripremu tla prije jesenske sjetve?',
        helper: 'Predloži novu radnju za naš popis i opiši kada se radi, što vrtlar dobiva i zašto pripada ovoj fazi.',
    },
};

export const Disabled: Story = { args: { disabled: true } };

/** As the last cell of a two-column grid of record cards. */
export const InGrid: Story = {
    decorators: [
        (Story) => (
            <div className="grid w-[640px] max-w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {['Sorta A', 'Sorta B', 'Sorta C'].map((name) => (
                    <div
                        className="rounded-lg border border-b-4 border-tertiary bg-card p-4"
                        key={name}
                    >
                        {name}
                    </div>
                ))}
                <Story />
            </div>
        ),
    ],
};
