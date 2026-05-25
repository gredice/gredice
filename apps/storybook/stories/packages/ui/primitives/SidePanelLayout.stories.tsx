import { Button } from '@gredice/ui/Button';
import { PanelSection } from '@gredice/ui/PanelSection';
import { Row } from '@gredice/ui/Row';
import {
    SidePanelLayout,
    SidePanelToggleButton,
} from '@gredice/ui/SidePanelLayout';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

const meta = {
    title: 'packages/ui/Surfaces/SidePanelLayout',
    component: SidePanelLayout,
    tags: ['autodocs'],
    args: {
        children: null,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'SidePanelLayout provides shared left and right panel hiding behavior with circular header toggle buttons that become plain when closed.',
            },
        },
    },
} satisfies Meta<typeof SidePanelLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

function Demo({
    initialLeftOpen = true,
    initialRightOpen = true,
}: {
    initialLeftOpen?: boolean;
    initialRightOpen?: boolean;
}) {
    const [leftOpen, setLeftOpen] = useState(initialLeftOpen);
    const [rightOpen, setRightOpen] = useState(initialRightOpen);

    return (
        <Stack spacing={4}>
            <Row spacing={2} className="justify-end">
                <Button size="sm" variant="solid">
                    Spremi
                </Button>
                <SidePanelToggleButton
                    label="navigator"
                    onOpenChange={setLeftOpen}
                    open={leftOpen}
                    side="left"
                />
                <SidePanelToggleButton
                    label="panele"
                    onOpenChange={setRightOpen}
                    open={rightOpen}
                    side="right"
                />
            </Row>
            <SidePanelLayout
                leftOpen={leftOpen}
                leftPanel={
                    <Stack spacing={2}>
                        <Typography level="body3" semiBold>
                            Navigator
                        </Typography>
                        {['Zaglavlje', 'Kartice', 'FAQ'].map(
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
                }
                rightOpen={rightOpen}
                rightPanel={
                    <Stack spacing={3}>
                        <PanelSection
                            contentClassName="px-4 pt-1"
                            title="Detalji"
                        >
                            <Typography level="body3" secondary>
                                Ovaj panel se skriva iz layouta kada je
                                zatvoren.
                            </Typography>
                        </PanelSection>
                        <PanelSection contentClassName="px-4 pt-1" title="SEO">
                            <Typography level="body3" secondary>
                                Pojedinacne sekcije i dalje mogu imati vlastito
                                sklapanje.
                            </Typography>
                        </PanelSection>
                    </Stack>
                }
            >
                <div className="min-h-80 rounded-lg border border-dashed bg-muted/20 p-8">
                    <Typography level="h4" semiBold>
                        Glavni sadrzaj
                    </Typography>
                    <Typography level="body2" secondary>
                        Srednji stupac dobiva vise prostora kada se lijevi ili
                        desni panel zatvori.
                    </Typography>
                </div>
            </SidePanelLayout>
        </Stack>
    );
}

export const Default: Story = {
    render: () => <Demo />,
};

export const LeftClosed: Story = {
    render: () => <Demo initialLeftOpen={false} />,
};

export const BothClosed: Story = {
    render: () => <Demo initialLeftOpen={false} initialRightOpen={false} />,
};
