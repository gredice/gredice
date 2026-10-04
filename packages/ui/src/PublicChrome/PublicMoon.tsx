import type { PublicEnvironmentSnapshot } from './publicEnvironment';

export function PublicMoon({
    moon,
}: {
    moon: PublicEnvironmentSnapshot['moon'];
}) {
    return (
        <svg
            aria-hidden="true"
            className="public-environment-moon"
            data-testid="public-environment-moon"
            style={{ left: `${moon.left}%`, top: `${moon.top}%` }}
            viewBox="0 0 100 100"
        >
            <g transform={`rotate(${moon.brightLimbAngle} 50 50)`}>
                <path d={moon.illuminationPath} fill="#f4f0dc" />
            </g>
            <circle
                cx="50"
                cy="50"
                fill="none"
                r="48"
                stroke="rgb(255 255 255 / 0.26)"
                strokeWidth="1.5"
            />
        </svg>
    );
}
