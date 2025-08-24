import type React from 'react';

const createDayNightIcon = (
    DayIcon: React.FC<React.SVGProps<SVGSVGElement>>,
    NightIcon: React.FC<React.SVGProps<SVGSVGElement>>,
) => ({
    day: DayIcon,
    night: NightIcon,
});

export const Sunny = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano</title>
            <circle cx="16" cy="16" r="8" fill="#FFD700" />
            <path
                d="M16 3V6M16 26V29M29 16H26M6 16H3M25.5 6.5L23.4 8.6M8.6 23.4L6.5 25.5M25.5 25.5L23.4 23.4M8.6 8.6L6.5 6.5"
                stroke="#FFD700"
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
            <title>Mjesečno</title>
            <path
                d="M22 16C22 19.3137 19.3137 22 16 22C12.6863 22 10 19.3137 10 16C10 12.6863 12.6863 10 16 10C19.3137 10 22 12.6863 22 16Z"
                fill="#C0C0C0"
            />
            <path
                d="M20 8C17.7909 8 16 6.20914 16 4C16 6.20914 14.2091 8 12 8C14.2091 8 16 9.79086 16 12C16 9.79086 17.7909 8 20 8Z"
                fill="#C0C0C0"
            />
        </svg>
    ),
);

export const SunnyLightClouds = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa slabim oblacima</title>
            <circle cx="12" cy="8" r="4" fill="#FFD700" />
            <path
                d="M12 1V3M12 13V15M19 8H17M7 8H5M16.5 3.5L15 5M9 11L7.5 12.5M16.5 12.5L15 11M9 5L7.5 3.5"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z"
                fill="#E6E6E6"
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
            <title>Mjesečno sa slabim oblacima</title>
            <path
                d="M14 6C11.7909 6 10 4.20914 10 2C10 4.20914 8.20914 6 6 6C8.20914 6 10 7.79086 10 10C10 7.79086 11.7909 6 14 6Z"
                fill="#C0C0C0"
            />
            <path
                d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z"
                fill="#A9A9A9"
            />
        </svg>
    ),
);

export const SunnyMediumClouds = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima</title>
            <circle cx="14" cy="12" r="5" fill="#FFD700" />
            <path
                d="M14 4V6M14 18V20M22 12H20M8 12H6M19.5 6.5L18 8M10 16L8.5 17.5M19.5 17.5L18 16M10 8L8.5 6.5"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z"
                fill="#E6E6E6"
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
            <title>Mjesečno sa srednjim oblacima</title>
            <path
                d="M16 8C13.7909 8 12 6.20914 12 4C12 6.20914 10.2091 8 8 8C10.2091 8 12 9.79086 12 12C12 9.79086 13.7909 8 16 8Z"
                fill="#C0C0C0"
            />
            <path
                d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z"
                fill="#A9A9A9"
            />
        </svg>
    ),
);

export const SunnyHeavyClouds = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa teškim oblacima</title>
            <circle cx="12" cy="10" r="4" fill="#FFD700" />
            <path
                d="M12 3V5M12 15V17M19 10H17M7 10H5M16.5 5.5L15 7M9 13L7.5 14.5M16.5 14.5L15 13M9 7L7.5 5.5"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M28 20.5C28 24.6421 24.6421 28 20.5 28H7.5C3.35786 28 0 24.6421 0 20.5C0 16.3579 3.35786 13 7.5 13H20.5C24.6421 13 28 16.3579 28 20.5Z"
                fill="#E6E6E6"
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
            <title>Mjesečno sa teškim oblacima</title>
            <path
                d="M14 6C11.7909 6 10 4.20914 10 2C10 4.20914 8.20914 6 6 6C8.20914 6 10 7.79086 10 10C10 7.79086 11.7909 6 14 6Z"
                fill="#C0C0C0"
            />
            <path
                d="M28 20.5C28 24.6421 24.6421 28 20.5 28H7.5C3.35786 28 0 24.6421 0 20.5C0 16.3579 3.35786 13 7.5 13H20.5C24.6421 13 28 16.3579 28 20.5Z"
                fill="#A9A9A9"
            />
        </svg>
    ),
);
