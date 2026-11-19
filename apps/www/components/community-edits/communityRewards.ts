import { getAchievementDefinitions } from '@gredice/js/achievements';

const sunflowerFormatter = new Intl.NumberFormat('hr-HR');

/** Badges of the community editing family, lowest threshold first. */
function communityEditingBadges() {
    return getAchievementDefinitions()
        .flatMap((definition) =>
            definition.category === 'community_editing' &&
            definition.threshold !== undefined
                ? [
                      {
                          title: definition.title,
                          threshold: definition.threshold,
                          rewardSunflowers: definition.rewardSunflowers,
                      },
                  ]
                : [],
        )
        .sort((left, right) => left.threshold - right.threshold);
}

/** The next badge a contributor with `acceptedCount` accepted suggestions earns. */
export function nextCommunityEditingBadge(acceptedCount: number) {
    const badges = communityEditingBadges();
    const nextIndex = badges.findIndex(
        (badge) => badge.threshold > acceptedCount,
    );
    const badge = badges[nextIndex];
    if (!badge) {
        return null;
    }

    return {
        ...badge,
        previousThreshold: badges[nextIndex - 1]?.threshold ?? 0,
        remaining: badge.threshold - acceptedCount,
    };
}

export function acceptedSuggestionsLabel(count: number) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit === 1 && lastTwoDigits !== 11) {
        return `${count.toString()} prihvaćen prijedlog`;
    }
    if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        !(lastTwoDigits >= 12 && lastTwoDigits <= 14)
    ) {
        return `${count.toString()} prihvaćena prijedloga`;
    }
    return `${count.toString()} prihvaćenih prijedloga`;
}

export function sunflowerRewardLabel(rewardSunflowers: number) {
    return `${sunflowerFormatter.format(rewardSunflowers)} suncokreta`;
}

/** One sentence about the next badge, or `null` when every badge is earned. */
export function communityRewardHint(acceptedCount: number) {
    const badge = nextCommunityEditingBadge(acceptedCount);
    if (!badge) {
        return null;
    }

    const reward = sunflowerRewardLabel(badge.rewardSunflowers);
    if (acceptedCount === 0 && badge.threshold === 1) {
        return `Tvoj prvi prihvaćeni prijedlog donosi značku ${badge.title} i ${reward}.`;
    }

    return `Još ${acceptedSuggestionsLabel(badge.remaining)} do značke ${badge.title} i ${reward}.`;
}
