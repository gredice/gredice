import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import styles from './BlockOptionsArt.module.css';
import {
    type BlockOptionsArt,
    type BlockOptionsTone,
    blockOptionsArtSrc,
    getBlockOptionsArtTone,
} from './blockOptionsArtwork';

/** Class names for a pop-up tile, so its medallion reacts to the tile. */
export const blockOptionsTileClassName = styles.tile;

/**
 * A chunky candy button in a role colour. Pass `data-tone` with the same
 * tone on the element.
 */
export function blockOptionsCandyClassName(className?: string) {
    return cx(styles.toned, styles.candy, className);
}

/** A sunflower price chip. */
export const blockOptionsChipClassName = styles.chip;

const medallionSizes = {
    sm: { box: 'size-9', image: 'size-8', pixels: 32 },
    md: { box: 'size-11', image: 'size-10', pixels: 40 },
    lg: { box: 'size-16', image: 'size-14', pixels: 56 },
} as const;

/**
 * A round candy token holding one piece of generated HUD artwork. With
 * `pop` it bounces in when it mounts; `popIndex` staggers a row of them.
 */
export function BlockOptionsMedallion({
    art,
    className,
    pop = false,
    popIndex,
    size = 'md',
    tone = getBlockOptionsArtTone(art),
}: {
    art: BlockOptionsArt;
    className?: string;
    pop?: boolean;
    popIndex?: 0 | 1 | 2 | 3 | 'late';
    size?: keyof typeof medallionSizes;
    tone?: BlockOptionsTone;
}) {
    const dimensions = medallionSizes[size];
    return (
        <span
            aria-hidden
            className={cx(
                styles.toned,
                styles.medallion,
                pop && styles.pop,
                dimensions.box,
                className,
            )}
            data-block-options-medallion={art}
            data-pop-index={popIndex}
            data-tone={tone}
        >
            <Image
                alt=""
                className={cx(dimensions.image, 'max-w-none object-contain')}
                draggable={false}
                height={dimensions.pixels}
                loading="eager"
                src={blockOptionsArtSrc[art]}
                unoptimized
                width={dimensions.pixels}
            />
        </span>
    );
}

/**
 * The confetti ring a pop-up opens with, drawn once from the point it grows
 * out of. Not drawn under reduced motion.
 */
export function BlockOptionsBurst({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cx(styles.burst, className)}
            data-block-options-burst
        >
            <span className={styles.burstRing} />
            <span className={styles.burstSparkle} />
            <span className={styles.burstSparkle} />
            <span className={styles.burstSparkle} />
            <span className={styles.burstSparkle} />
            <span className={styles.burstSparkle} />
            <span className={styles.burstSparkle} />
            <span className={styles.burstSparkle} />
        </span>
    );
}

/**
 * Bounces an element in when it mounts, like a medallion; set
 * `data-pop-index` on it to stagger it.
 */
export const blockOptionsPopClassName = styles.pop;

/** The carry hint grows out of its tail with a small overshoot. */
export const blockOptionsBubblePopClassName = styles.bubble;

/** The Expand bar rises with a small overshoot, never from transparent. */
export const blockOptionsBarPopClassName = styles.barPop;
