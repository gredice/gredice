import { PageNav } from '@gredice/ui/Nav';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Navigation/PageNav',
    component: PageNav,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'PageNav provides the fixed public-site navigation shell with Signalco-compatible logo, links, and children props.',
            },
        },
    },
    args: {
        logo: <Typography semiBold>Gredice</Typography>,
        links: [
            { href: '/', text: 'Gredica' },
            { href: '/', text: 'Biljke' },
            { href: '/', text: 'Radnje' },
        ],
    },
    render: (args) => (
        <div className="min-h-48">
            <PageNav {...args}>
                <Typography level="body3" secondary>
                    Akcija
                </Typography>
            </PageNav>
        </div>
    ),
} satisfies Meta<typeof PageNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
