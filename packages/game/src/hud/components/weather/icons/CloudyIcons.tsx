import type React from 'react';

const createDayNightIcon = (
    DayIcon: React.FC<React.SVGProps<SVGSVGElement>>,
    NightIcon: React.FC<React.SVGProps<SVGSVGElement>>,
) => ({
    day: DayIcon,
    night: NightIcon,
});

export const CloudyLight = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Slabo oblačno</title>
            <path
                d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z"
                fill="#E6E6E6"
            />
            <circle cx="20" cy="12" r="4" fill="#FFD700" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Slabo oblačno</title>
            <path
                d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z"
                fill="#A9A9A9"
            />
        </svg>
    ),
);

export const CloudyMedium = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Umjereno oblačno</title>
            <path
                d="M28 20.5C28 24.6421 24.6421 28 20.5 28H7.5C3.35786 28 0 24.6421 0 20.5C0 16.3579 3.35786 13 7.5 13H20.5C24.6421 13 28 16.3579 28 20.5Z"
                fill="#E6E6E6"
            />
            <circle cx="22" cy="10" r="3" fill="#FFD700" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Umjereno oblačno</title>
            <path
                d="M28 20.5C28 24.6421 24.6421 28 20.5 28H7.5C3.35786 28 0 24.6421 0 20.5C0 16.3579 3.35786 13 7.5 13H20.5C24.6421 13 28 16.3579 28 20.5Z"
                fill="#A9A9A9"
            />
        </svg>
    ),
);

export const SunnyMediumCloudsAndFoggy = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i maglom</title>
            <circle cx="12" cy="8" r="4" fill="#FFD700" />
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#E6E6E6"
            />
            <path
                d="M6 24H26M8 27H24M10 30H22"
                stroke="#CCCCCC"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Mjesečno sa srednjim oblacima i maglom</title>
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#A9A9A9"
            />
            <path
                d="M6 24H26M8 27H24M10 30H22"
                stroke="#CCCCCC"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
);
