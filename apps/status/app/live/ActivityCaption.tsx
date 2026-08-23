import type { LiveActivityEvent } from '../../lib/live/types';
import styles from './live.module.css';

type ActivityCaptionProps = {
    event: LiveActivityEvent | null;
};

export function ActivityCaption({ event }: ActivityCaptionProps) {
    if (!event) {
        return (
            <div
                className={styles.activityCard}
                data-category="garden"
                data-state="quiet"
            >
                <div className={styles.activityMeta}>
                    <span className={styles.activitySpark} aria-hidden="true" />
                    <span>Između događaja</span>
                    <span className={styles.activityTrail} aria-hidden="true" />
                </div>
                <p className={styles.activityTitle}>
                    Sustav je trenutačno tih.
                </p>
                <p className={styles.activityDetail}>
                    Čekamo sljedeći stvarni trag iz Gredica, Vercela ili
                    GitHuba.
                </p>
            </div>
        );
    }

    return (
        <div
            aria-atomic="true"
            aria-live="off"
            className={styles.activityCard}
            data-category={event.category}
            data-source={event.source}
            key={event.id}
        >
            <div className={styles.activityMeta}>
                <span className={styles.activitySpark} aria-hidden="true" />
                <span>
                    {event.source === 'gredice' ? 'Gredice' : event.source} ·{' '}
                    {event.label}
                </span>
                <span className={styles.activityTrail} aria-hidden="true" />
            </div>
            <p className={styles.activityTitle}>{event.title}</p>
            <p className={styles.activityDetail}>{event.detail}</p>
        </div>
    );
}
