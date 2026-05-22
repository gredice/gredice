import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Navigation/Tabs',
    component: Tabs,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Tabs switch between sibling views with Gredice control styling, a sliding active indicator, and Radix keyboard behavior.',
            },
        },
    },
    args: {
        defaultValue: 'overview',
    },
    render: (args) => (
        <Tabs {...args} className="w-full max-w-xl">
            <TabsList>
                <TabsTrigger value="overview">Pregled</TabsTrigger>
                <TabsTrigger value="calendar">Kalendar</TabsTrigger>
                <TabsTrigger value="history">Povijest</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Trenutno stanje gredice, zadnje radnje i korisni sazetak.
                </div>
            </TabsContent>
            <TabsContent value="calendar">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Kalendar sjetve, zalijevanja i planiranih radnji.
                </div>
            </TabsContent>
            <TabsContent value="history">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Povijest promjena i biljeske korisnika.
                </div>
            </TabsContent>
        </Tabs>
    ),
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FullWidth: Story = {
    render: (args) => (
        <Tabs {...args} className="w-full max-w-xl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Pregled</TabsTrigger>
                <TabsTrigger value="calendar">Kalendar</TabsTrigger>
                <TabsTrigger value="history">Povijest</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Kompaktna navigacija za panele koji zauzimaju cijelu sirinu.
                </div>
            </TabsContent>
            <TabsContent value="calendar">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Sadrzaj ostaje poravnat ispod liste tabova.
                </div>
            </TabsContent>
            <TabsContent value="history">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Aktivni tab koristi povrsinu kartice bez skakanja layouta.
                </div>
            </TabsContent>
        </Tabs>
    ),
};

export const Disabled: Story = {
    render: (args) => (
        <Tabs {...args} className="w-full max-w-xl">
            <TabsList>
                <TabsTrigger value="overview">Pregled</TabsTrigger>
                <TabsTrigger value="calendar">Kalendar</TabsTrigger>
                <TabsTrigger value="history" disabled>
                    Povijest
                </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Nedostupni tab ostaje vidljiv, ali nije interaktivan.
                </div>
            </TabsContent>
            <TabsContent value="calendar">
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                    Tipkovnica preskace onemogucene tabove.
                </div>
            </TabsContent>
        </Tabs>
    ),
};

export const LongLabels: Story = {
    render: (args) => (
        <div className="w-72">
            <Tabs {...args}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">
                        Pregled dostupnosti
                    </TabsTrigger>
                    <TabsTrigger value="calendar">Kalendar sijanja</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                    <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                        Ogranicena sirina provjerava da tekst ostaje uredan.
                    </div>
                </TabsContent>
                <TabsContent value="calendar">
                    <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-xs">
                        Dugi nazivi ostaju centrirani u triggerima.
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    ),
};
