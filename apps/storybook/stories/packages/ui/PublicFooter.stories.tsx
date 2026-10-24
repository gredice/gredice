import { Footer1 } from '@gredice/ui/cms';
import { CompanyFacebook, CompanyGitHub } from '@gredice/ui/icons';
import {
    Logotype,
    PublicFooterLandscape,
    PublicFooterOrigin,
} from '@gredice/ui/PublicChrome';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Public Chrome/Public Footer',
    component: Footer1,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The quiet baseline footer groups a compact logo and social controls above a secondary origin/copyright row, with the divider above the brand group. Croatian and EU flags stay 24 × 18 px beside regular 13 px text; narrow footers center and stack the baseline. The garden artwork follows without another divider.',
            },
        },
    },
    args: {
        tagline: 'Gredice d.o.o',
        asset: <Logotype className="h-auto w-[210px] max-w-full" />,
        description: <PublicFooterOrigin />,
        ctas: [
            {
                label: 'Facebook',
                href: 'https://gredice.link/fb',
                icon: <CompanyFacebook />,
            },
            {
                label: 'GitHub',
                href: 'https://github.com/gredice',
                icon: <CompanyGitHub />,
            },
        ],
        features: [
            {
                header: 'Informacije',
                ctas: [
                    { label: 'O nama', href: '/o-nama' },
                    { label: 'Kontaktiraj nas', href: '/kontakt' },
                ],
            },
        ],
    },
    render: (args) => (
        <div className="[--muted-foreground:28_16.3%_24%]">
            <Footer1 {...args} />
            <PublicFooterLandscape />
        </div>
    ),
} satisfies Meta<typeof Footer1>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
    decorators: [
        (Story) => (
            <div className="max-w-[375px]">
                <Story />
            </div>
        ),
    ],
};

export const Dark: Story = {
    render: (args) => (
        <div className="dark bg-background text-foreground">
            <Footer1 {...args} />
            <PublicFooterLandscape phase="night" />
        </div>
    ),
};
