import { useState, type FormEvent } from 'react';
import { Button } from '@signalco/ui-primitives/Button';
import { CardActions } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { UseMutationResult } from '@tanstack/react-query';
import type { CurrentUser } from '../../hooks/useCurrentUser';
import type {
    UpdateUserResponse,
    UpdateUserVariables,
} from '../../hooks/useUpdateUser';

const fullDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const currentYear = new Date().getUTCFullYear();

type UserBirthdaySectionProps = {
    user: CurrentUser | null | undefined;
    updateUser: UseMutationResult<
        UpdateUserResponse,
        Error,
        UpdateUserVariables,
        unknown
    >;
};

export function UserBirthdaySection({
    user,
    updateUser,
}: UserBirthdaySectionProps) {
    const [birthdayMessage, setBirthdayMessage] = useState<string | null>(null);
    const [birthdayError, setBirthdayError] = useState<string | null>(null);

    if (!user) {
        return null;
    }

    const birthday = user.birthday ?? null;
    const lastRewardDisplay = user.birthdayLastRewardAt
        ? fullDateFormatter.format(user.birthdayLastRewardAt)
        : null;
    const nextChangeDate = user.birthdayLastUpdatedAt
        ? (() => {
              const date = new Date(user.birthdayLastUpdatedAt.getTime());
              date.setUTCFullYear(date.getUTCFullYear() + 1);
              return date;
          })()
        : null;
    const nextChangeDisplay = nextChangeDate
        ? fullDateFormatter.format(nextChangeDate)
        : null;
    const birthdayLocked = nextChangeDate ? nextChangeDate > new Date() : false;

    const handleBirthdayUpdate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBirthdayError(null);
        setBirthdayMessage(null);

        const formData = new FormData(event.currentTarget);
        const dayValue = formData.get('birthdayDay')?.toString().trim();
        const monthValue = formData.get('birthdayMonth')?.toString().trim();
        const yearValue = formData.get('birthdayYear')?.toString().trim();

        if (!dayValue || !monthValue) {
            setBirthdayError('Unesi i dan i mjesec rođendana.');
            return;
        }

        const day = Number(dayValue);
        const month = Number(monthValue);
        const year = yearValue ? Number(yearValue) : undefined;

        if (
            Number.isNaN(day) ||
            Number.isNaN(month) ||
            day <= 0 ||
            month <= 0
        ) {
            setBirthdayError('Datum rođendana mora biti broj.');
            return;
        }

        if (yearValue && (Number.isNaN(year) || year < 1900 || year > currentYear)) {
            setBirthdayError('Godina rođendana nije valjana.');
            return;
        }

        try {
            const result = await updateUser.mutateAsync({
                birthday: {
                    day,
                    month,
                    ...(year ? { year } : {}),
                },
            });

            if (result?.birthdayReward) {
                setBirthdayMessage(
                    result.birthdayReward.late
                        ? 'Dodali smo ti 6000 🌻 s malim zakašnjenjem. Sretan rođendan!'
                        : 'Dodali smo ti 6000 🌻! Sretan rođendan!'
                );
            } else {
                setBirthdayMessage('Rođendan je spremljen.');
            }
        } catch (error) {
            setBirthdayError(
                error instanceof Error
                    ? error.message
                    : 'Spremanje rođendana nije uspjelo.'
            );
        }
    };

    return (
        <form onSubmit={handleBirthdayUpdate}>
            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Rođendan
                </Typography>
                <Row spacing={2} className="flex-wrap">
                    <Input
                        name="birthdayDay"
                        label="Dan"
                        type="number"
                        min={1}
                        max={31}
                        placeholder="npr. 12"
                        defaultValue={birthday?.day?.toString() ?? ''}
                        disabled={birthdayLocked || updateUser.isPending}
                    />
                    <Input
                        name="birthdayMonth"
                        label="Mjesec"
                        type="number"
                        min={1}
                        max={12}
                        placeholder="npr. 7"
                        defaultValue={birthday?.month?.toString() ?? ''}
                        disabled={birthdayLocked || updateUser.isPending}
                    />
                    <Input
                        name="birthdayYear"
                        label="Godina (nije obavezna)"
                        type="number"
                        min={1900}
                        max={currentYear}
                        placeholder="npr. 1992"
                        defaultValue={
                            birthday?.year != null ? birthday.year.toString() : ''
                        }
                        disabled={birthdayLocked || updateUser.isPending}
                    />
                </Row>
                <Stack spacing={1}>
                    <Typography level="body3">
                        {birthdayLocked && nextChangeDisplay
                            ? `Rođendan možeš ponovno promijeniti ${nextChangeDisplay}.`
                            : 'Na tvoj rođendan darujemo ti 6000 🌻.'}
                    </Typography>
                    {lastRewardDisplay && (
                        <Typography level="body3">
                            Posljednji rođendanski poklon: {lastRewardDisplay}
                        </Typography>
                    )}
                    {birthdayMessage && (
                        <Typography level="body3" className="text-emerald-600">
                            {birthdayMessage}
                        </Typography>
                    )}
                    {birthdayError && (
                        <Typography level="body3" className="text-red-600">
                            {birthdayError}
                        </Typography>
                    )}
                </Stack>
                <CardActions className="justify-end">
                    <Button
                        size="sm"
                        variant="solid"
                        type="submit"
                        loading={updateUser.isPending}
                        disabled={updateUser.isPending || birthdayLocked}
                    >
                        Spremi rođendan
                    </Button>
                </CardActions>
            </Stack>
        </form>
    );
}
