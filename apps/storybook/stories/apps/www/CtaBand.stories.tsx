import DeliveryTruck from '@apps/www/assets/DeliveryTruck.webp';
import RaisedBedMaintenance from '@apps/www/assets/RaisedBedMaintenance.webp';
import { CtaBand } from '@apps/www/components/shared/CtaBand';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Shared/CtaBand',
    component: CtaBand,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'CtaBand closes a public page with a bright brand band and the main "Složi svoju gredicu" action. Pages set their own heading, copy, optional secondary link and illustration.',
            },
        },
    },
    args: {
        id: 'cta-band-story-title',
        title: 'Tvoja gredica čeka. Složi je u par klikova.',
        description: 'Odaberi povrće danas, a mi se pobrinemo za sve ostalo.',
        secondaryAction: { href: '/cjenik', label: 'Pogledaj cjenik' },
    },
    render: (args) => (
        <div className="max-w-5xl p-4">
            <CtaBand {...args} />
        </div>
    ),
} satisfies Meta<typeof CtaBand>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutSecondaryAction: Story = {
    args: {
        secondaryAction: undefined,
    },
};

export const RaisedBedPage: Story = {
    args: {
        title: 'Tvoja gredica od 2 m² čeka.',
        description:
            'Odaberi biljke u aplikaciji, a tim na OPG-u pripremi tlo, posadi ih i brine o njima.',
        image: RaisedBedMaintenance,
    },
};

export const LongCopy: Story = {
    args: {
        title: 'Svježe iz tvoje gredice, ravno na tvoj kućni prag, bez odlaska u trgovinu.',
        description:
            'Složi gredicu danas, a kad plodovi dozriju, uberemo ih i dostavimo na tvoju adresu u Gradu Zagrebu ili do 100 km vožnje od lokacije za preuzimanje.',
        image: DeliveryTruck,
    },
};
