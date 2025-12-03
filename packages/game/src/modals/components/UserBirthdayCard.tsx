import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardActions, CardContent } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type FormEvent, useState } from 'react';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUpdateUser } from '../../hooks/useUpdateUser';

const MIN_BIRTH_YEAR = 1900;

const fullDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

const currentYear = new Date().getUTCFullYear();

export function UserBirthdayCard() {
    const { data: user } = useCurrentUser();
    const updateUser = useUpdateUser();
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

        if (
            year &&
            (Number.isNaN(year) || year < MIN_BIRTH_YEAR || year > currentYear)
        ) {
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
                        ? `Darujemo ti mali 🎁 s malim zakašnjenjem. Sretan rođendan!`
                        : `Darujemo ti mali 🎁! Sretan rođendan!`,
                );
            } else {
                setBirthdayMessage('Rođendan je spremljen.');
            }
        } catch (error) {
            setBirthdayError(
                error instanceof Error
                    ? error.message
                    : 'Spremanje rođendana nije uspjelo.',
            );
        }
    };

    return (
        <Card>
            <CardContent noHeader>
                <form onSubmit={handleBirthdayUpdate}>
                    <Stack spacing={2}>
                        <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
                            <Input
                                name="birthdayDay"
                                label="Dan"
                                type="number"
                                min={1}
                                max={31}
                                placeholder="npr. 12"
                                defaultValue={birthday?.day?.toString() ?? ''}
                                disabled={
                                    birthdayLocked || updateUser.isPending
                                }
                            />
                            <Input
                                name="birthdayMonth"
                                label="Mjesec"
                                type="number"
                                min={1}
                                max={12}
                                placeholder="npr. 7"
                                defaultValue={birthday?.month?.toString() ?? ''}
                                disabled={
                                    birthdayLocked || updateUser.isPending
                                }
                            />
                            <Input
                                name="birthdayYear"
                                label="Godina (nije obavezna)"
                                type="number"
                                min={MIN_BIRTH_YEAR}
                                max={currentYear}
                                placeholder="npr. 1992"
                                defaultValue={
                                    birthday?.year != null
                                        ? birthday.year.toString()
                                        : ''
                                }
                                disabled={
                                    birthdayLocked || updateUser.isPending
                                }
                            />
                        </div>
                        <Stack spacing={1}>
                            <Typography level="body3">
                                {birthdayLocked && nextChangeDisplay
                                    ? `Rođendan možeš ponovno promijeniti ${nextChangeDisplay}.`
                                    : `Na tvoj rođendan darujemo ti mali 🎁.`}
                            </Typography>
                            {lastRewardDisplay && (
                                <Typography level="body3">
                                    Posljednji rođendanski poklon:{' '}
                                    {lastRewardDisplay}
                                </Typography>
                            )}
                            {birthdayMessage && (
                                <Typography
                                    level="body3"
                                    className="text-emerald-600"
                                >
                                    {birthdayMessage}
                                </Typography>
                            )}
                            {birthdayError && (
                                <Typography
                                    level="body3"
                                    className="text-red-600"
                                >
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
                                disabled={
                                    updateUser.isPending || birthdayLocked
                                }
                            >
                                Spremi rođendan
                            </Button>
                        </CardActions>
                    </Stack>
                </form>
            </CardContent>
        </Card>
    );
}
