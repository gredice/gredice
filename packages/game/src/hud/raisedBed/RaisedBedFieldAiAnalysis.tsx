import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';
import { useRaisedBedFieldAiAnalysis } from '../../hooks/useRaisedBedFieldAiAnalysis';

type DiaryEntry = {
    imageUrls?: string[] | null;
};

export function RaisedBedFieldAiAnalysis({
    gardenId,
    raisedBedId,
    positionIndex,
    entries,
}: {
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
    entries: DiaryEntry[] | undefined;
}) {
    const latestImageUrl = useMemo(() => {
        return entries
            ?.flatMap((entry) => entry.imageUrls ?? [])
            .find((url) => Boolean(url));
    }, [entries]);

    const [imageUrl, setImageUrl] = useState(latestImageUrl ?? '');
    const analyzeMutation = useRaisedBedFieldAiAnalysis();

    return (
        <Stack spacing={1} className="p-2 border rounded-md">
            <Typography level="body2" semiBold>
                AI analiza biljke sa slike
            </Typography>
            <Typography level="body3">
                Zalijepi URL fotografije vrta. Odgovor će biti spremljen u
                dnevnik.
            </Typography>
            <Input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://..."
                aria-label="URL fotografije vrta"
            />
            <Button
                variant="solid"
                disabled={!imageUrl || analyzeMutation.isPending}
                loading={analyzeMutation.isPending}
                onClick={() => {
                    analyzeMutation.mutate({
                        gardenId,
                        raisedBedId,
                        positionIndex,
                        imageUrl,
                    });
                }}
            >
                Analiziraj fotografiju
            </Button>
            {analyzeMutation.error && (
                <Typography level="body3" className="text-red-600">
                    {analyzeMutation.error.message}
                </Typography>
            )}
        </Stack>
    );
}
