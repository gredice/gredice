import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';

export const raisedBedFieldPlantStatusItems = [
    { value: 'new', label: 'Novo' },
    { value: 'planned', label: 'Planirano' },
    {
        value: 'pendingVerification',
        label: 'Čeka verifikaciju',
    },
    { value: 'sowed', label: 'Sijano' },
    { value: 'sprouted', label: 'Proklijalo' },
    { value: 'firstFlowers', label: 'Prvi cvjetovi' },
    { value: 'firstFruitSet', label: 'Prvi plodovi' },
    { value: 'notSprouted', label: 'Nije proklijalo' },
    { value: 'died', label: 'Uginulo' },
    { value: 'ready', label: 'Spremno' },
    { value: 'harvested', label: 'Ubrane' },
    { value: 'removed', label: 'Uklonjene' },
].map((item) => ({
    ...item,
    icon: (
        <GamePlantStatusIcon
            status={item.value}
            className="size-5 shrink-0"
            aria-hidden
        />
    ),
}));
