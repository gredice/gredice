import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { PanelSection } from '@gredice/ui/PanelSection';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Surfaces/PanelSection',
    component: PanelSection,
    tags: ['autodocs'],
    args: {
        title: 'Detalji',
        defaultOpen: true,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'PanelSection provides the collapsible side-panel sections used across admin details and editor sidebars.',
            },
        },
    },
    render: (args) => (
        <div className="w-80">
            <PanelSection {...args} contentClassName="px-4 pt-1">
                <Stack spacing={2}>
                    <Typography level="body2" semiBold>
                        Stranica je u izradi
                    </Typography>
                    <Typography level="body3" secondary>
                        Urednici mogu sklopiti manje vazne panele i ostaviti
                        vidljiv samo aktivni kontekst.
                    </Typography>
                </Stack>
            </PanelSection>
        </div>
    ),
} satisfies Meta<typeof PanelSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closed: Story = {
    args: {
        defaultOpen: false,
    },
};

export const WithAction: Story = {
    args: {
        title: 'Sekcija',
        action: (
            <Button size="xs" variant="plain">
                Uredi
            </Button>
        ),
    },
};

export const PlainCompact: Story = {
    args: {
        title: 'Navigator',
        density: 'compact',
        variant: 'plain',
        action: (
            <Button
                aria-label="Dodaj sekciju"
                className="size-7 px-0"
                size="sm"
                variant="plain"
            >
                <Add className="size-4" />
            </Button>
        ),
    },
    render: (args) => (
        <div className="w-64">
            <PanelSection {...args} contentClassName="pt-1">
                <Stack spacing={1}>
                    {['Osnovno zaglavlje', 'Zaglavlje s vizualom'].map(
                        (section, index) => (
                            <Button
                                key={section}
                                className="justify-start px-2"
                                size="sm"
                                variant={index === 0 ? 'solid' : 'plain'}
                            >
                                {index + 1}. {section}
                            </Button>
                        ),
                    )}
                </Stack>
            </PanelSection>
        </div>
    ),
};

export const LongContent: Story = {
    args: {
        title: 'Publish readiness',
    },
    render: (args) => (
        <div className="w-80">
            <PanelSection {...args} contentClassName="px-4 pt-1">
                <Stack spacing={2}>
                    {[
                        'Meta naslov nedostaje.',
                        'Meta opis nedostaje.',
                        'Sekcija 1 ima obavezna prazna polja.',
                        'Sekcija 2 ima obavezna prazna polja.',
                    ].map((issue) => (
                        <Typography
                            key={issue}
                            level="body3"
                            className="text-amber-600"
                        >
                            {issue}
                        </Typography>
                    ))}
                </Stack>
            </PanelSection>
        </div>
    ),
};
