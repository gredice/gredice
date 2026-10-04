import { Table } from '@gredice/ui/Table';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const rows = [
    {
        name: 'Gredica A1',
        status: 'Spremna',
        updatedAt: '21. svibnja 2026.',
    },
    {
        name: 'Gredica B4',
        status: 'Zalijevanje',
        updatedAt: '20. svibnja 2026.',
    },
    {
        name: 'Gredica C2',
        status: 'Ceka sadnju',
        updatedAt: '19. svibnja 2026.',
    },
];

const meta = {
    title: 'packages/ui/Data Display/Table',
    component: Table,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Table keeps the Signalco namespace API while using first-party Gredice table styling.',
            },
        },
    },
    render: (args) => (
        <Table {...args}>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Zadnja izmjena</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {rows.map((row) => (
                    <Table.Row key={row.name}>
                        <Table.Cell>{row.name}</Table.Cell>
                        <Table.Cell>{row.status}</Table.Cell>
                        <Table.Cell>{row.updatedAt}</Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    ),
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
    args: {
        className: '[&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2',
    },
};
