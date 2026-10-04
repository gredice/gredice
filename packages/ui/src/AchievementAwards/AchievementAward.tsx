import {
    type AchievementVisualGrade,
    formatAchievementLevel,
    getAchievementDefinition,
} from '@gredice/js/achievements';
import type { SVGProps } from 'react';
import unknownArtwork from '../GameIcons/assets/information.webp';
import { achievementArtwork } from './artwork';

const artworkSizes: Record<AchievementVisualGrade, number> = {
    first_steps: 400,
    growing: 432,
    experienced: 464,
    mastery: 488,
    legendary: 512,
};

/** Identical reserved space; major awards have a larger optical silhouette. */
export function AchievementAward({
    achievementKey,
    ...props
}: SVGProps<SVGSVGElement> & { achievementKey: string }) {
    const definition = getAchievementDefinition(achievementKey);
    const dedicatedArtwork = definition
        ? achievementArtwork[definition.artworkKey]
        : undefined;
    const source = dedicatedArtwork ?? unknownArtwork;
    const size = definition ? artworkSizes[definition.visualGrade] : 400;
    const label = definition
        ? `${definition.title.trim()} · Razina ${formatAchievementLevel(definition.level)}`
        : 'Nepoznato postignuće';
    const decorative =
        props['aria-hidden'] === true || props['aria-hidden'] === 'true';
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={96}
            height={96}
            viewBox="0 0 512 512"
            fill="none"
            role="img"
            aria-label={decorative ? undefined : label}
            data-achievement-key={achievementKey}
            data-visual-grade={definition?.visualGrade}
            {...(dedicatedArtwork
                ? {}
                : { 'data-achievement-placeholder': '' })}
            {...props}
        >
            {!decorative && <title>{props['aria-label'] ?? label}</title>}
            <image
                href={typeof source === 'string' ? source : source.src}
                x={(512 - size) / 2}
                y={512 - size}
                width={size}
                height={size}
                preserveAspectRatio="xMidYMid meet"
            />
        </svg>
    );
}
