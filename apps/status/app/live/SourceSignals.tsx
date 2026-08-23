import {
    type LiveActivitySource,
    liveActivitySources,
} from '../../lib/live/types';
import styles from './live.module.css';

type SourceSignalsProps = {
    connectedSources: LiveActivitySource[];
    sourceTotals: Record<LiveActivitySource, number>;
};

const labels: Record<LiveActivitySource, string> = {
    gredice: 'Gredice',
    vercel: 'Vercel',
    github: 'GitHub',
};

export function SourceSignals({
    connectedSources,
    sourceTotals,
}: SourceSignalsProps) {
    return (
        <fieldset className={styles.sources}>
            <legend className={styles.visuallyHidden}>
                Povezani izvori aktivnosti
            </legend>
            {liveActivitySources.map((source) => (
                <span
                    className={styles.sourceSignal}
                    data-active={sourceTotals[source] > 0}
                    data-connected={connectedSources.includes(source)}
                    data-source={source}
                    key={source}
                >
                    <span aria-hidden="true" className={styles.sourceSpark} />
                    {labels[source]}
                </span>
            ))}
        </fieldset>
    );
}
