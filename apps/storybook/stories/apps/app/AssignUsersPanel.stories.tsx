import {
    AssignUsersPanel,
    type AssignUsersPanelUser,
} from '@apps/app/app/admin/schedule/AssignUsersPanel';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

const fewUsers: AssignUsersPanelUser[] = [
    {
        id: 'aleks',
        userName: 'aleks@gredice.com',
        displayName: 'Aleks',
        avatarUrl: null,
        achievementCount: 12,
    },
    {
        id: 'vesna',
        userName: 'vesna@gredice.com',
        displayName: 'Vesna',
        avatarUrl: null,
        achievementCount: 2,
    },
    {
        id: 'matea',
        userName: 'matea@gredice.com',
        displayName: null,
        avatarUrl: null,
    },
];

const manyUsers: AssignUsersPanelUser[] = [
    ...fewUsers,
    {
        id: 'durdica',
        userName: 'durdica@gredice.com',
        displayName: 'Đurđica',
        avatarUrl: null,
    },
    {
        id: 'zeljka',
        userName: 'zeljka@gredice.com',
        displayName: 'Željka',
        avatarUrl: null,
        achievementCount: 30,
    },
    {
        id: 'ivan',
        userName: 'ivan@gredice.com',
        displayName: 'Ivan',
        avatarUrl: null,
    },
    {
        id: 'petra',
        userName: 'petra.dugoime.prezime@gredice.com',
        displayName: 'Petra s jako dugim imenom i prezimenom',
        avatarUrl: null,
    },
];

const meta = {
    title: 'App/Schedule/AssignUsersPanel',
    component: AssignUsersPanel,
    parameters: { layout: 'padded' },
    args: {
        title: 'Dodjela radnje',
        description: (
            <>
                Odaberi korisnike kojima želiš dodijeliti zadatak{' '}
                <strong>Zalijevanje presadnica u stakleniku</strong>.
            </>
        ),
        users: fewUsers,
        selectedUserIds: ['vesna'],
        onSelectedUserIdsChange: () => {},
        onCancel: () => {},
        onSave: () => {},
    },
    render: function Panel(args) {
        const [selectedUserIds, setSelectedUserIds] = useState(
            args.selectedUserIds,
        );
        return (
            <div className="max-w-lg rounded-lg border bg-background p-6">
                <AssignUsersPanel
                    {...args}
                    selectedUserIds={selectedUserIds}
                    onSelectedUserIdsChange={setSelectedUserIds}
                />
            </div>
        );
    },
} satisfies Meta<typeof AssignUsersPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FewUsers: Story = {};

export const Cleared: Story = { args: { selectedUserIds: [] } };

export const WithSearch: Story = {
    args: { users: manyUsers, selectedUserIds: ['aleks', 'durdica'] },
};

export const EmptyFarm: Story = { args: { users: [], selectedUserIds: [] } };

export const NoSearchMatches: Story = {
    args: { users: manyUsers },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.type(
            canvas.getByRole('searchbox', { name: 'Pretraži korisnike' }),
            'nepostojeci',
        );
        await expect(
            canvas.getByText('Nema korisnika za ovu pretragu.'),
        ).toBeVisible();
    },
};

export const Saving: Story = { args: { isSaving: true } };

export const SaveError: Story = {
    args: { errorMessage: 'Greška pri spremanju dodjele korisnika.' },
};

export const UnavailableSelection: Story = {
    args: {
        title: 'Skupna dodjela korisnika',
        description: 'Odaberi korisnike za sve zadatke (4) za gredicu 7.',
        users: [
            ...fewUsers,
            {
                id: 'ivan',
                userName: 'ivan@gredice.com',
                displayName: 'Ivan',
                avatarUrl: null,
                unavailableReason:
                    'Više nije dostupan za sve zadatke. Ukloni odabir.',
            },
        ],
        selectedUserIds: ['aleks', 'ivan'],
        notice: 'Neki odabrani korisnici više nisu dostupni za sve zadatke. Ukloni ih iz odabira prije spremanja.',
        saveDisabled: true,
    },
};

export const ConfirmedTasksNeedUser: Story = {
    args: {
        title: 'Skupna dodjela korisnika',
        description:
            'Odaberi korisnike za sve zadatke (4) za gredicu 7. Potvrđeni zadaci (2) moraju ostati dodijeljeni, pa odaberi barem jednog korisnika.',
        selectedUserIds: [],
        saveDisabled: true,
    },
};
