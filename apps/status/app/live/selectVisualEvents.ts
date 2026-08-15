import {
    type LiveActivityEvent,
    liveActivityCategories,
} from '../../lib/live/types';

export function selectVisualEvents(
    events: LiveActivityEvent[],
    perCategory: number,
) {
    return liveActivityCategories
        .flatMap((category) =>
            events
                .filter((event) => event.category === category)
                .slice(-perCategory),
        )
        .sort((first, second) =>
            first.occurredAt.localeCompare(second.occurredAt),
        );
}
