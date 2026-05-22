import { Field } from '@apps/app/components/shared/fields/Field';
import { FieldSet } from '@apps/app/components/shared/fields/FieldSet';
import { FormFields } from '@apps/app/components/shared/fields/FormFields';
import { ServerActionButton } from '@apps/app/components/shared/ServerActionButton';
import { ServerActionIconButton } from '@apps/app/components/shared/ServerActionIconButton';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Duplicate, Save } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/app/Admin/TablesAndForms',
    component: FormFields,
    tags: ['autodocs'],
    args: {
        fields: [],
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Admin table and field display patterns used by internal data-dense forms after the shared UI migration.',
            },
        },
    },
    render: () => (
        <div className="max-w-5xl bg-secondary/40 p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Inventory review</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={8}>
                        <FieldSet>
                            <Field name="ID" value="inventory-1042" mono />
                            <Field name="Published" value />
                            <Field
                                name="Updated"
                                value={new Date('2026-05-21T08:30:00Z')}
                            />
                            <Field name="Owner" value="Operations" />
                        </FieldSet>

                        <FormFields
                            fields={[
                                {
                                    name: 'Quantity',
                                    value: 126,
                                },
                                {
                                    name: 'Low count threshold',
                                    value: 24,
                                },
                                {
                                    name: 'Barcode',
                                    value: '3851234567890',
                                    mono: true,
                                },
                            ]}
                        />

                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Item</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Quantity</Table.Head>
                                    <Table.Head></Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                <Table.Row>
                                    <Table.Cell>
                                        <Typography>Salata maslac</Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip color="success">Available</Chip>
                                    </Table.Cell>
                                    <Table.Cell>126</Table.Cell>
                                    <Table.Cell>
                                        <ServerActionIconButton title="Duplicate item">
                                            <Duplicate className="size-4" />
                                        </ServerActionIconButton>
                                    </Table.Cell>
                                </Table.Row>
                                <Table.Row>
                                    <Table.Cell>
                                        <Typography>
                                            Rajcica volovsko srce
                                        </Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip color="warning">Low stock</Chip>
                                    </Table.Cell>
                                    <Table.Cell>18</Table.Cell>
                                    <Table.Cell>
                                        <ServerActionIconButton title="Duplicate item">
                                            <Duplicate className="size-4" />
                                        </ServerActionIconButton>
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        </Table>

                        <div>
                            <ServerActionButton
                                startDecorator={<Save className="size-4" />}
                            >
                                Save changes
                            </ServerActionButton>
                        </div>
                    </Stack>
                </CardContent>
            </Card>
        </div>
    ),
} satisfies Meta<typeof FormFields>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
