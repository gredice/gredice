import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Card } from '../../components/shared/Card';
import type { MyCommunityEdit } from '../../hooks/useMyCommunityEdits';
import { formatGardenDate } from '../vrtovi/publicGardenFormatting';
import { isSameSitePath, mySuggestionStatus } from './mySuggestionStatus';

function suggestionTimeline(item: MyCommunityEdit) {
    const sent = `Poslano ${formatGardenDate(item.createdAt)}`;
    if (item.status === 'applied' && item.appliedAt) {
        return `${sent} · Objavljeno ${formatGardenDate(item.appliedAt)}`;
    }
    if (
        item.reviewedAt &&
        (item.status === 'rejected' || item.status === 'conflicted')
    ) {
        return `${sent} · Pregledano ${formatGardenDate(item.reviewedAt)}`;
    }
    return sent;
}

/** One of the visitor's own suggestions with its review status. */
export function MySuggestionItem({ item }: { item: MyCommunityEdit }) {
    const status = mySuggestionStatus(item.status);
    const canLink = isSameSitePath(item.publicPath);

    return (
        <Card className="p-4" data-suggestion-status={item.status}>
            <Stack spacing={3}>
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <Stack spacing={0.5} className="min-w-0">
                        <Typography
                            className="break-words"
                            component="h3"
                            level="body1"
                            semiBold
                        >
                            {item.title}
                        </Typography>
                        {item.context ? (
                            <Typography level="body2">
                                {item.context}
                            </Typography>
                        ) : null}
                    </Stack>
                    <Chip color={status.color} size="sm" variant="soft">
                        {status.label}
                    </Chip>
                </div>
                <Stack spacing={1}>
                    {item.changeLabels.length > 0 ? (
                        <Typography className="break-words" level="body2">
                            Izmjene: {item.changeLabels.join(', ')}
                        </Typography>
                    ) : null}
                    <Typography level="body3">
                        {suggestionTimeline(item)}
                    </Typography>
                </Stack>
                {item.status === 'conflicted' ? (
                    <Typography level="body2">
                        Stranica se u međuvremenu promijenila pa prijedlog nismo
                        mogli primijeniti.
                    </Typography>
                ) : null}
                {item.submitterMessage ? (
                    <div className="rounded-md border border-border/70 bg-muted/40 p-3">
                        <Typography level="body3" semiBold>
                            Poruka moderatora
                        </Typography>
                        <Typography
                            className="whitespace-pre-line break-words"
                            level="body2"
                        >
                            {item.submitterMessage}
                        </Typography>
                    </div>
                ) : null}
                {canLink && item.status === 'applied' ? (
                    <Button
                        className="self-start"
                        href={item.publicPath}
                        size="sm"
                        variant="outlined"
                    >
                        Pogledaj stranicu
                        <span className="sr-only"> – {item.title}</span>
                    </Button>
                ) : null}
                {canLink && item.status === 'conflicted' ? (
                    <Button
                        className="self-start"
                        href={item.publicPath}
                        size="sm"
                        variant="outlined"
                    >
                        Predloži ponovno
                        <span className="sr-only"> – {item.title}</span>
                    </Button>
                ) : null}
            </Stack>
        </Card>
    );
}
