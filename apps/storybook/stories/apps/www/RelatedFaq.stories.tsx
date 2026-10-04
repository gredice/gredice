import { FaqSectionView } from '@apps/www/components/faq/FaqSectionView';
import { faqTestEntries } from '@apps/www/components/faq/faqTestEntries';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/FAQ/Related questions',
    component: FaqSectionView,
    args: { title: 'Pitanja o dostavi', entries: faqTestEntries },
    parameters: { layout: 'padded' },
} satisfies Meta<typeof FaqSectionView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { entries: [] } };
export const Mobile: Story = {
    globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const LongQuestion: Story = {
    args: {
        entries: [
            {
                ...faqTestEntries[0],
                information: {
                    ...faqTestEntries[0].information,
                    header: 'Kako mogu provjeriti mogućnost dostave na svoju adresu i odabrati termin koji odgovara mojem rasporedu?',
                },
            },
        ],
    },
};
