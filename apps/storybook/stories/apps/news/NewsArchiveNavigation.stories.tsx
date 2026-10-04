import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NewsArchiveNavigation } from '../../../../news/components/NewsArchiveNavigation';
import { NewsCategoryFilter } from '../../../../news/components/NewsCategoryFilter';

const meta = {
    title: 'apps/news/NewsArchiveNavigation',
    component: NewsArchiveNavigation,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    args: { active: 'news' },
    decorators: [
        (Story) => (
            <div className="mx-auto max-w-5xl p-4">
                <Story />
            </div>
        ),
    ],
    render: (args) => (
        <NewsArchiveNavigation {...args}>
            <NewsCategoryFilter
                categories={[
                    { name: 'Dostava', count: 3 },
                    { name: 'Uzgoj', count: 12 },
                ]}
            />
        </NewsArchiveNavigation>
    ),
} satisfies Meta<typeof NewsArchiveNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllPosts: Story = {};

export const FilteredBlog: Story = {
    args: { active: undefined },
    render: (args) => (
        <NewsArchiveNavigation {...args}>
            <NewsCategoryFilter
                activeCategory="dostava"
                categories={[
                    { name: 'Dostava', count: 3 },
                    { name: 'Uzgoj', count: 12 },
                ]}
            />
        </NewsArchiveNavigation>
    ),
};

export const NoCategories: Story = {
    render: (args) => (
        <NewsArchiveNavigation {...args}>
            <NewsCategoryFilter categories={[]} />
        </NewsArchiveNavigation>
    ),
};

export const WeeklySummaries: Story = {
    args: { active: 'changelog' },
    render: (args) => <NewsArchiveNavigation {...args} />,
};

export const MobileLongTopic: Story = {
    args: { active: undefined },
    decorators: [
        (Story) => (
            <div className="max-w-[288px]">
                <Story />
            </div>
        ),
    ],
    render: (args) => (
        <NewsArchiveNavigation {...args}>
            <NewsCategoryFilter
                activeCategory="Savjeti za uzgoj povrća u malom vrtu"
                categories={[
                    { name: 'Dostava', count: 3 },
                    { name: 'Savjeti za uzgoj povrća u malom vrtu', count: 12 },
                ]}
            />
        </NewsArchiveNavigation>
    ),
};
