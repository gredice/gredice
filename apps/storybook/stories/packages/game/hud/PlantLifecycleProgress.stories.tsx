import { plantFieldStatusEmoji } from '@packages/game/hud/raisedBed/PlantFieldStatusEmoji';
import {
    getPlantLifecycleProgressData,
    type PlantLifecycleAttributes,
    PlantLifecycleProgress,
} from '@packages/game/hud/raisedBed/PlantLifecycleProgress';
import type { RaisedBedFieldPlantHistoryEntry } from '@packages/game/utils/raisedBedFields';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const now = new Date('2026-05-13T12:00:00.000Z');
const msPerDay = 1000 * 60 * 60 * 24;
const plantDetailsUrl =
    'https://www.gredice.com/biljke/rajcica/sorte/cherry-rajcica';

const plantAttributes = {
    germinationWindowMin: 5,
    germinationWindowMax: 10,
    growthWindowMin: 60,
    growthWindowMax: 90,
    harvestWindowMin: 14,
    harvestWindowMax: 30,
} satisfies PlantLifecycleAttributes;

const statusLabels = {
    new: 'Čeka sijanje',
    planned: 'Planirana',
    pendingVerification: 'Posijana',
    sowed: 'Posijana',
    sprouted: 'Proklijala',
    firstFlowers: 'Prvi cvjetovi',
    firstFruitSet: 'Prvi plodovi',
    notSprouted: 'Nije proklijala',
    died: 'Neuspjela',
    ready: 'Spremna za berbu',
    harvested: 'Ubrana',
    removed: 'Uklonjena',
} as const;

type PlantStatus = keyof typeof statusLabels;

type LifecycleExample = {
    title: string;
    description: string;
    field: RaisedBedFieldPlantHistoryEntry;
};

function isoDaysFromNow(days: number) {
    return new Date(now.getTime() + days * msPerDay).toISOString();
}

function buildField(
    plantStatus: PlantStatus,
    overrides: Partial<RaisedBedFieldPlantHistoryEntry> = {},
): RaisedBedFieldPlantHistoryEntry {
    return {
        active: true,
        plantSortId: 101,
        positionIndex: 0,
        plantStatus,
        createdAt: isoDaysFromNow(-80),
        updatedAt: now.toISOString(),
        ...overrides,
    };
}

const plantStateExamples: LifecycleExample[] = [
    {
        title: 'new',
        description: 'Planiran datum bez sijanja',
        field: buildField('new', {
            plantScheduledDate: isoDaysFromNow(4),
            plantSowDate: null,
        }),
    },
    {
        title: 'planned',
        description: 'Zakazano sijanje',
        field: buildField('planned', {
            plantScheduledDate: isoDaysFromNow(2),
            plantSowDate: null,
        }),
    },
    {
        title: 'pendingVerification',
        description: 'Sjeme je posijano i čeka potvrdu',
        field: buildField('pendingVerification', {
            plantSowDate: isoDaysFromNow(-1),
        }),
    },
    {
        title: 'sowed',
        description: 'Klijanje u tijeku',
        field: buildField('sowed', {
            plantSowDate: isoDaysFromNow(-3),
        }),
    },
    {
        title: 'sprouted',
        description: 'Klijanje završeno, rast počeo',
        field: buildField('sprouted', {
            plantSowDate: isoDaysFromNow(-9),
            plantGrowthDate: isoDaysFromNow(-1),
        }),
    },
    {
        title: 'firstFlowers',
        description: 'Kasniji rast s poznatim datumom klijanja',
        field: buildField('firstFlowers', {
            plantSowDate: isoDaysFromNow(-62),
            plantGrowthDate: isoDaysFromNow(-53),
        }),
    },
    {
        title: 'firstFruitSet',
        description: 'Rast pri kraju prije berbe',
        field: buildField('firstFruitSet', {
            plantSowDate: isoDaysFromNow(-86),
            plantGrowthDate: isoDaysFromNow(-76),
        }),
    },
    {
        title: 'notSprouted',
        description: 'Neuspjelo klijanje, spremno za uklanjanje',
        field: buildField('notSprouted', {
            plantSowDate: isoDaysFromNow(-14),
            stoppedDate: isoDaysFromNow(-1),
            toBeRemoved: true,
        }),
    },
    {
        title: 'died',
        description: 'Biljka je odumrla nakon rasta',
        field: buildField('died', {
            plantSowDate: isoDaysFromNow(-40),
            plantGrowthDate: isoDaysFromNow(-30),
            plantDeadDate: isoDaysFromNow(-2),
            stoppedDate: isoDaysFromNow(-2),
            toBeRemoved: true,
        }),
    },
    {
        title: 'ready',
        description: 'Berba je počela',
        field: buildField('ready', {
            plantSowDate: isoDaysFromNow(-98),
            plantGrowthDate: isoDaysFromNow(-88),
            plantReadyDate: isoDaysFromNow(-2),
        }),
    },
    {
        title: 'harvested',
        description: 'Berba je završena',
        field: buildField('harvested', {
            plantSowDate: isoDaysFromNow(-122),
            plantGrowthDate: isoDaysFromNow(-112),
            plantReadyDate: isoDaysFromNow(-32),
            plantHarvestedDate: isoDaysFromNow(-1),
            stoppedDate: isoDaysFromNow(-1),
        }),
    },
    {
        title: 'removed',
        description: 'Biljka je uklonjena iz polja',
        field: buildField('removed', {
            active: false,
            plantSowDate: isoDaysFromNow(-126),
            plantGrowthDate: isoDaysFromNow(-116),
            plantReadyDate: isoDaysFromNow(-46),
            plantRemovedDate: isoDaysFromNow(-3),
            stoppedDate: isoDaysFromNow(-3),
        }),
    },
];

const valueExamples: LifecycleExample[] = [
    {
        title: 'Bez datuma sijanja',
        description: 'Samo planirani datum',
        field: buildField('planned', {
            plantScheduledDate: isoDaysFromNow(3),
            plantSowDate: null,
        }),
    },
    {
        title: 'Klijanje 20%',
        description: '2 dana od sijanja u očekivanih 10',
        field: buildField('sowed', {
            plantSowDate: isoDaysFromNow(-2),
        }),
    },
    {
        title: 'Klijanje 80%',
        description: '8 dana od sijanja',
        field: buildField('sowed', {
            plantSowDate: isoDaysFromNow(-8),
        }),
    },
    {
        title: 'Rast 33%',
        description: '30 dana rasta od očekivanih 90',
        field: buildField('sprouted', {
            plantSowDate: isoDaysFromNow(-40),
            plantGrowthDate: isoDaysFromNow(-30),
        }),
    },
    {
        title: 'Rast 75%',
        description: '68 dana rasta',
        field: buildField('firstFruitSet', {
            plantSowDate: isoDaysFromNow(-78),
            plantGrowthDate: isoDaysFromNow(-68),
        }),
    },
    {
        title: 'Berba 50%',
        description: '15 dana u berbi od očekivanih 30',
        field: buildField('ready', {
            plantSowDate: isoDaysFromNow(-100),
            plantGrowthDate: isoDaysFromNow(-90),
            plantReadyDate: isoDaysFromNow(-15),
        }),
    },
    {
        title: 'Berba 100%',
        description: 'Istekao očekivani prozor berbe',
        field: buildField('ready', {
            plantSowDate: isoDaysFromNow(-120),
            plantGrowthDate: isoDaysFromNow(-110),
            plantReadyDate: isoDaysFromNow(-35),
        }),
    },
    {
        title: 'Budući datum berbe',
        description: 'Apsolutni dani ne smiju biti negativni',
        field: buildField('ready', {
            plantSowDate: isoDaysFromNow(-60),
            plantGrowthDate: isoDaysFromNow(-45),
            plantReadyDate: isoDaysFromNow(140),
        }),
    },
    {
        title: 'Crveni terminalni indikator',
        description: 'Neuspjela biljka za uklanjanje',
        field: buildField('died', {
            plantSowDate: isoDaysFromNow(-50),
            plantGrowthDate: isoDaysFromNow(-40),
            plantDeadDate: isoDaysFromNow(-5),
            stoppedDate: isoDaysFromNow(-5),
            toBeRemoved: true,
        }),
    },
];

function StatusTrigger({ field }: { field: RaisedBedFieldPlantHistoryEntry }) {
    const status = field.plantStatus as PlantStatus | undefined;
    return (
        <div className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex flex-col gap-1 items-center justify-center">
            <span className="text-2xl leading-none" aria-hidden="true">
                {plantFieldStatusEmoji(status)}
            </span>
            <span className="px-3 text-center text-sm font-semibold leading-tight text-primary">
                {status ? statusLabels[status] : 'Nepoznato'}
            </span>
        </div>
    );
}

function LifecyclePanel({ example }: { example: LifecycleExample }) {
    const lifecycleData = getPlantLifecycleProgressData({
        field: example.field,
        plantAttributes,
        now,
    });

    return (
        <section className="rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <h3 className="m-0 text-sm font-semibold text-primary">
                        {example.title}
                    </h3>
                    <p className="m-0 text-xs text-secondary-foreground">
                        {example.description}
                    </p>
                </div>
                <code className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">
                    {example.field.plantStatus}
                </code>
            </div>
            <PlantLifecycleProgress
                field={example.field}
                plantAttributes={plantAttributes}
                lifecycleData={lifecycleData}
                plantDetailsUrl={plantDetailsUrl}
                statusTrigger={<StatusTrigger field={example.field} />}
            />
        </section>
    );
}

function LifecycleGrid({ examples }: { examples: LifecycleExample[] }) {
    return (
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {examples.map((example) => (
                <LifecyclePanel key={example.title} example={example} />
            ))}
        </div>
    );
}

const meta = {
    title: 'packages/game/hud/raisedBed/PlantLifecycleProgress',
    component: PlantLifecycleProgress,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'PlantLifecycleProgress renders the raised-bed plant lifecycle ring and stage rows for field details.',
            },
        },
    },
} satisfies Meta<typeof PlantLifecycleProgress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllPlantStates: Story = {
    name: 'All plant states',
    render: () => <LifecycleGrid examples={plantStateExamples} />,
};

export const ProgressValues: Story = {
    name: 'Progress values',
    render: () => <LifecycleGrid examples={valueExamples} />,
};

export const NarrowContainer: Story = {
    name: 'Narrow container',
    render: () => (
        <div className="max-w-[22rem] p-4">
            <LifecyclePanel example={valueExamples[5]} />
        </div>
    ),
};
