'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useMyCommunityEdits } from '../../hooks/useMyCommunityEdits';
import { MySuggestionItem } from './MySuggestionItem';
import { MySuggestionsEmpty } from './MySuggestionsEmpty';
import { MySuggestionsProgress } from './MySuggestionsProgress';
import { MySuggestionsSignedOut } from './MySuggestionsSignedOut';
import { MySuggestionsSkeleton } from './MySuggestionsSkeleton';

/** The signed-in visitor's suggestions, their status and the moderator's reply. */
export function MySuggestionsView() {
    const { data: user, isLoading: isLoadingUser } = useCurrentUser();
    const suggestions = useMyCommunityEdits();

    function content() {
        if (isLoadingUser || (user && suggestions.isPending)) {
            return <MySuggestionsSkeleton />;
        }

        if (!user) {
            return <MySuggestionsSignedOut />;
        }

        if (suggestions.isError || !suggestions.data) {
            return (
                <Alert
                    color="danger"
                    endDecorator={
                        <Button
                            disabled={suggestions.isFetching}
                            onClick={() => void suggestions.refetch()}
                            size="sm"
                            type="button"
                            variant="outlined"
                        >
                            Pokušaj ponovno
                        </Button>
                    }
                >
                    Učitavanje prijedloga nije uspjelo.
                </Alert>
            );
        }

        const { acceptedCount, items } = suggestions.data;
        return (
            <Stack spacing={6}>
                <MySuggestionsProgress acceptedCount={acceptedCount} />
                {items.length === 0 ? (
                    <MySuggestionsEmpty />
                ) : (
                    <Stack spacing={3}>
                        <Typography component="h2" level="h6" semiBold>
                            Poslani prijedlozi
                        </Typography>
                        <ul className="space-y-3">
                            {items.map((item) => (
                                <li key={item.id}>
                                    <MySuggestionItem item={item} />
                                </li>
                            ))}
                        </ul>
                    </Stack>
                )}
            </Stack>
        );
    }

    return <div className="mx-auto w-full max-w-3xl">{content()}</div>;
}
