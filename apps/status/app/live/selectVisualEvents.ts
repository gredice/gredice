import {
    type LiveActivityEvent,
    liveActivityCategories,
    liveActivitySources,
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

export function selectPlaybackEvents(
    events: LiveActivityEvent[],
    maximum: number,
) {
    const queues = liveActivitySources.map((source) =>
        events
            .filter((event) => event.source === source)
            .sort((first, second) =>
                second.occurredAt.localeCompare(first.occurredAt),
            ),
    );
    const selected: LiveActivityEvent[] = [];

    while (selected.length < maximum && queues.some((queue) => queue.length)) {
        for (const queue of queues) {
            const event = queue.shift();
            if (event) {
                selected.push(event);
            }

            if (selected.length === maximum) {
                break;
            }
        }
    }

    return selected;
}
