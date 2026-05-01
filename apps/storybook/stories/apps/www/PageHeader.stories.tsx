import { PageHeader } from '@apps/www/components/shared/PageHeader';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Layout/PageHeader',
    component: PageHeader,
    tags: ['autodocs'],
    args: {
        alternativeName: 'Raised bed planning',
        header: 'Plan a productive garden',
        padded: true,
        subHeader:
            'A page header pattern for public content pages with optional visual context and supporting actions.',
        visual: (
            <div className="flex size-full items-center justify-center bg-secondary text-primary">
                <RaisedBedIcon className="size-20" physicalId="B4" />
            </div>
        ),
    },
    parameters: {
        layout: 'fullscreen',
    },
    render: (args) => (
        <div className="mx-auto max-w-5xl px-6">
            <PageHeader {...args}>
                <div className="rounded-lg border border-border bg-card p-4 text-sm leading-6 text-card-foreground">
                    Supporting content can sit beside the page title on wider
                    viewports.
                </div>
            </PageHeader>
        </div>
    ),
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
