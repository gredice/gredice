import type React from 'react';

const createDayNightIcon = (
    DayIcon: React.FC<React.SVGProps<SVGSVGElement>>,
    NightIcon: React.FC<React.SVGProps<SVGSVGElement>>,
) => ({
    day: DayIcon,
    night: NightIcon,
});

export const SunnyMediumCloudsAndLightRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i slabom kišom</title>
            <circle cx="12" cy="8" r="4" fill="#FFD700" />
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#E6E6E6"
            />
            <path
                d="M10 24L9 26M16 24L15 26M22 24L21 26"
                stroke="#4A90E2"
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
            <title>Mjesečno sa srednjim oblacima i slabom kišom</title>
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#A9A9A9"
            />
            <path
                d="M10 24L9 26M16 24L15 26M22 24L21 26"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
);

export const SunnyMediumCloudsAndMediumRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i umjerenom kišom</title>
            <circle cx="12" cy="8" r="4" fill="#FFD700" />
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#E6E6E6"
            />
            <path
                d="M8 24L7 27M16 24L15 27M24 24L23 27"
                stroke="#4A90E2"
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
            <title>Mjesečno sa srednjim oblacima i umjerenom kišom</title>
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#A9A9A9"
            />
            <path
                d="M8 24L7 27M16 24L15 27M24 24L23 27"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
);

export const SunnyMediumCloudsAndHeavyRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i jakom kišom</title>
            <circle cx="12" cy="8" r="4" fill="#FFD700" />
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#E6E6E6"
            />
            <path
                d="M6 24L5 28M12 24L11 28M18 24L17 28M24 24L23 28"
                stroke="#4A90E2"
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
            <title>Mjesečno sa srednjim oblacima i jakom kišom</title>
            <path
                d="M26 16.5C26 19.5376 23.5376 22 20.5 22H9.5C6.46243 22 4 19.5376 4 16.5C4 13.4624 6.46243 11 9.5 11H20.5C23.5376 11 26 13.4624 26 16.5Z"
                fill="#A9A9A9"
            />
            <path
                d="M6 24L5 28M12 24L11 28M18 24L17 28M24 24L23 28"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
);
