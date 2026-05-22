import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Surfaces/Card',
    component: Card,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Card provides the first-party surface API used by admin tables, public pages, and game overlays.',
            },
        },
    },
    render: (args) => (
        <Card {...args} className="w-80">
            <CardHeader>
                <CardTitle>Dnevni zadaci</CardTitle>
                <Typography level="body3" secondary>
                    Pregled najvaznijih radnji za danas.
                </Typography>
            </CardHeader>
            <CardContent>
                <Stack spacing={2}>
                    <Typography level="body2">
                        3 sadnje cekaju potvrdu
                    </Typography>
                    <Typography level="body2">
                        2 zalijevanja su u tijeku
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    ),
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
    },
};

export const WithActions: Story = {
    render: (args) => (
        <Card {...args} className="w-80">
            <CardHeader>
                <CardTitle>Rezervacija termina</CardTitle>
            </CardHeader>
            <CardContent>
                <Typography level="body2" secondary>
                    Korisnik je zatrazio promjenu vremena dostave.
                </Typography>
            </CardContent>
            <CardActions justifyContent="end">
                <Button size="sm" variant="outlined">
                    Odbij
                </Button>
                <Button size="sm">Prihvati</Button>
            </CardActions>
        </Card>
    ),
};

export const Overflow: Story = {
    render: (args) => (
        <Card {...args} className="w-80">
            <CardHeader>
                <CardTitle>Tablicni prikaz</CardTitle>
            </CardHeader>
            <CardOverflow className="border-t">
                <div className="grid grid-cols-3 gap-px bg-border text-sm">
                    {[
                        'Naziv',
                        'Status',
                        'Datum',
                        'Rikola',
                        'Spremno',
                        'Danas',
                    ].map((value) => (
                        <div className="bg-card p-2" key={value}>
                            {value}
                        </div>
                    ))}
                </div>
            </CardOverflow>
        </Card>
    ),
};
