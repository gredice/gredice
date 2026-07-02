import {
    earnSunflowers,
    getSunflowers,
    getSunflowersHistory,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Add } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { revalidatePath } from 'next/cache';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import { Field } from '../../../../components/shared/fields/Field';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export async function AccountSunflowersCard({
    accountId,
}: {
    accountId: string;
}) {
    const currentSunflowers = await getSunflowers(accountId);
    const history = await getSunflowersHistory(accountId, 0, 10000);

    async function submitGiftSunflowers(formData: FormData) {
        'use server';
        await auth(['admin']);
        const amount = formData.get('amount') as string;
        const reason = formData.get('reason') as string;
        await earnSunflowers(accountId, parseInt(amount, 10), reason);
        revalidatePath(KnownPages.Account(accountId));
    }

    return (
        <Card className={scrollableTableCardClassName}>
            <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle>Suncokreti</CardTitle>
                <Popper
                    align="end"
                    className="w-80 p-3"
                    trigger={
                        <IconButton title="Dodjeli suncokrete">
                            <Add className="size-5" />
                        </IconButton>
                    }
                >
                    <Stack spacing={4}>
                        <Typography level="h5">Dodjeli suncokrete</Typography>
                        <form action={submitGiftSunflowers} className="min-w-0">
                            <Stack className="min-w-0" spacing={4}>
                                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Input
                                        label="Iznos"
                                        type="number"
                                        name="amount"
                                        defaultValue="0"
                                        fullWidth
                                    />
                                    <SelectItems
                                        className="min-w-0"
                                        label="Razlog"
                                        name="reason"
                                        defaultValue="gift"
                                        items={[
                                            { value: 'gift', label: 'Poklon' },
                                        ]}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    startDecorator={<Add className="size-5" />}
                                >
                                    Dodjeli
                                </Button>
                            </Stack>
                        </form>
                    </Stack>
                </Popper>
            </CardHeader>
            <CardContent className="pb-4">
                <Field name="Ukupno suncokreta" value={currentSunflowers} />
            </CardContent>
            <CardOverflow className={scrollableTableCardOverflowClassName}>
                {history.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>Nema suncokreta</NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {history.map((sunflower) => (
                            <li
                                key={sunflower.id}
                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <Stack spacing={1} className="min-w-0">
                                        <Typography
                                            level="body2"
                                            semiBold
                                            className="min-w-0 break-words"
                                        >
                                            {sunflower.type}
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="min-w-0 break-all text-muted-foreground"
                                        >
                                            {JSON.stringify(sunflower.data)}
                                        </Typography>
                                    </Stack>
                                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            className="w-fit"
                                        >
                                            {sunflower.amount.toLocaleString(
                                                'hr-HR',
                                            )}{' '}
                                            suncokreta
                                        </Chip>
                                        <Typography
                                            component="div"
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            <LocalDateTime>
                                                {sunflower.createdAt}
                                            </LocalDateTime>
                                        </Typography>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
