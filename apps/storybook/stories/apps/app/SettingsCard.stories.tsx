import { SettingsCard } from '@apps/app/app/admin/settings/_components/SettingsCard';
import { SettingsCardBody } from '@apps/app/app/admin/settings/_components/SettingsCardBody';
import { SettingsStatusChip } from '@apps/app/app/admin/settings/_components/SettingsStatusChip';
import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SettingsCardFormExample } from './SettingsCardFormExample';

const meta = {
    title: 'apps/app/Admin/Settings/SettingsCard',
    component: SettingsCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'SettingsCard frames one setting on the admin settings page: a title with an optional description and a status chip or actions beside it. The content is a SettingsCardBody and, for forms, a SettingsCardFooter with the SettingsFormMessage of the last save and the save button.',
            },
        },
    },
    args: {
        title: 'Google kalendar',
        description:
            'Zahtjevi za dostavu dodaju se u Google kalendar kada nastanu, a uklanjaju kada se otkažu.',
        children: null,
    },
    decorators: [
        (Story) => (
            // `settings` is the container the cards measure themselves against.
            <div className="@container/settings max-w-4xl">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof SettingsCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { children: <SettingsCardFormExample state={null} /> },
};

export const Connected: Story = {
    args: {
        aside: <SettingsStatusChip connected label="Povezano" />,
        children: <SettingsCardFormExample state={null} />,
    },
};

export const NotConnected: Story = {
    args: {
        aside: <SettingsStatusChip connected={false} label="Nije povezano" />,
        children: <SettingsCardFormExample state={null} />,
    },
};

export const Saving: Story = {
    args: { children: <SettingsCardFormExample state={null} saving /> },
};

export const Saved: Story = {
    args: {
        children: (
            <SettingsCardFormExample
                state={{
                    success: true,
                    message: 'Google kalendar je uspješno povezan.',
                }}
            />
        ),
    },
};

export const SaveFailed: Story = {
    args: {
        children: (
            <SettingsCardFormExample
                state={{
                    success: false,
                    message: 'Google račun i kalendar su obavezni.',
                }}
            />
        ),
    },
};

export const WithActions: Story = {
    args: {
        title: 'Kategorije zapisa',
        description: undefined,
        aside: (
            <>
                <Button size="sm" startDecorator={<Add className="size-4" />}>
                    Novi tip zapisa
                </Button>
                <Button
                    size="sm"
                    variant="outlined"
                    startDecorator={<Add className="size-4" />}
                >
                    Nova kategorija
                </Button>
            </>
        ),
        children: (
            <SettingsCardBody>
                <NoDataPlaceholder className="py-4">
                    Još nema kategorija zapisa.
                </NoDataPlaceholder>
            </SettingsCardBody>
        ),
    },
};

export const LongContent: Story = {
    args: {
        title: 'Društvene platforme s vrlo dugim nazivom postavke koji se prelama u više redaka',
        description:
            'Direktno slanje koristi provider konfiguraciju iz deployment environment varijabli. Svaka platforma ima vlastitu instalaciju i zasebne konfiguracije za više računa.',
        aside: <SettingsStatusChip connected label="12 aktivno" />,
        children: (
            <SettingsCardFormExample
                state={{
                    success: false,
                    message:
                        'Spremanje nije uspjelo jer privatni ključ nije u ispravnom formatu. Provjeri da ključ počinje s BEGIN PRIVATE KEY i pokušaj ponovno.',
                }}
            />
        ),
    },
};

export const Narrow: Story = {
    args: {
        aside: <SettingsStatusChip connected label="Povezano" />,
        children: (
            <SettingsCardFormExample
                state={{
                    success: true,
                    message: 'Google kalendar je uspješno povezan.',
                }}
            />
        ),
    },
    decorators: [
        (Story) => (
            <div className="max-w-sm">
                <Story />
            </div>
        ),
    ],
};
