import styles from './live.module.css';
import type {
    VisualizationMode,
    VisualizationView,
} from './visualizationViews';

type ViewControlsProps = {
    activeView: VisualizationView;
    mode: VisualizationMode;
    onChange: (mode: VisualizationMode) => void;
};

const controls: Array<{
    id: VisualizationMode;
    label: string;
    description: string;
}> = [
    { id: 'auto', label: 'slijed', description: 'Automatski mijenjaj prizore' },
    { id: 'orbit', label: 'orbite', description: 'Zadrži kružni prizor' },
    { id: 'rain', label: 'kiša', description: 'Zadrži kišu događaja' },
    { id: 'soil', label: 'tlo', description: 'Zadrži slojeve tla' },
    { id: 'network', label: 'mreža', description: 'Zadrži mrežu vrta' },
];

export function ViewControls({
    activeView,
    mode,
    onChange,
}: ViewControlsProps) {
    return (
        <div className={styles.viewControls}>
            <span className={styles.viewState}>
                {mode === 'auto' ? 'prizor se mijenja' : 'prizor je zadržan'}
            </span>
            <fieldset className={styles.viewButtons}>
                <legend className={styles.visuallyHidden}>
                    Odaberi prizor
                </legend>
                {controls.map((control) => {
                    const selected =
                        control.id === 'auto'
                            ? mode === 'auto'
                            : mode === control.id;
                    const current =
                        control.id !== 'auto' && activeView === control.id;

                    return (
                        <button
                            aria-label={control.description}
                            aria-pressed={selected}
                            className={styles.viewButton}
                            data-current={current}
                            key={control.id}
                            onClick={() => onChange(control.id)}
                            type="button"
                        >
                            {control.label}
                        </button>
                    );
                })}
            </fieldset>
        </div>
    );
}
