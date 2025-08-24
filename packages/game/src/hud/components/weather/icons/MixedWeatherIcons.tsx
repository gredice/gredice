import type React from 'react';

const createDayNightIcon = (
    DayIcon: React.FC<React.SVGProps<SVGSVGElement>>,
    NightIcon: React.FC<React.SVGProps<SVGSVGElement>>,
) => ({
    day: DayIcon,
    night: NightIcon,
});

export const SunnyMediumCloudsAndThunder = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i grmljavinom</title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
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
            <title>Mjesečno sa srednjim oblacima i grmljavinom</title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    ),
);

export const SunnyMediumCloudsThunderAndLightRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>
                Sunčano sa srednjim oblacima, grmljavinom i slabom kišom
            </title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 26L9 28M16 26L15 28M22 26L21 28"
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
            <title>
                Mjesečno sa srednjim oblacima, grmljavinom i slabom kišom
            </title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 26L9 28M16 26L15 28M22 26L21 28"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
);

export const SunnyMediumCloudsThunderAndMediumRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>
                Sunčano sa srednjim oblacima, grmljavinom i umjerenom kišom
            </title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M8 26L7 29M16 26L15 29M24 26L23 29"
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
            <title>
                Mjesečno sa srednjim oblacima, grmljavinom i umjerenom kišom
            </title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M8 26L7 29M16 26L15 29M24 26L23 29"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
);

export const SunnyMediumCloudsThunderAndHeavyRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>
                Sunčano sa srednjim oblacima, grmljavinom i jakom kišom
            </title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30"
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
            <title>
                Mjesečno sa srednjim oblacima, grmljavinom i jakom kišom
            </title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
);

export const SunnyMediumCloudsLightSnowyRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i slabom snježnom kišom</title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M10 26L9 28M16 26L15 28M22 26L21 28"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <circle cx="12" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Mjesečno sa srednjim oblacima i slabom snježnom kišom</title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M10 26L9 28M16 26L15 28M22 26L21 28"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <circle cx="12" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
);

export const SunnyMediumCloudsMediumSnowyRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>
                Sunčano sa srednjim oblacima i umjerenom snježnom kišom
            </title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M8 26L7 29M16 26L15 29M24 26L23 29"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <circle cx="10" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="18" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>
                Mjesečno sa srednjim oblacima i umjerenom snježnom kišom
            </title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M8 26L7 29M16 26L15 29M24 26L23 29"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <circle cx="10" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="18" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
);

export const SunnyMediumCloudsHeavySnowyRain = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i jakom snježnom kišom</title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <circle cx="8" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="24" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Mjesečno sa srednjim oblacima i jakom snježnom kišom</title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30"
                stroke="#4A90E2"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <circle cx="8" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="24" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
);

export const SunnyMediumCloudsLightSnow = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i slabim snijegom</title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Mjesečno sa srednjim oblacima i slabim snijegom</title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
        </svg>
    ),
);

export const SunnyMediumCloudsMediumSnow = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i umjerenim snijegom</title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="13" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="19" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Mjesečno sa srednjim oblacima i umjerenim snijegom</title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="13" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="19" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
);

export const SunnyMediumCloudsHeavySnow = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Sunčano sa srednjim oblacima i jakim snijegom</title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <circle cx="8" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="14" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="11" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="17" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="23" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Mjesečno sa srednjim oblacima i jakim snijegom</title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <circle cx="8" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="14" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="11" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="17" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="23" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
);

export const SunnyMediumCloudsLightSnowAndThunder = createDayNightIcon(
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>
                Sunčano sa srednjim oblacima, slabim snijegom i grmljavinom
            </title>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#E6E6E6"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>
                Mjesečno sa srednjim oblacima, slabim snijegom i grmljavinom
            </title>
            <path
                d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14"
                stroke="#C0C0C0"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <path
                d="M24 18C24 21.3137 21.3137 24 18 24H10C6.68629 24 4 21.3137 4 18C4 14.6863 6.68629 12 10 12H18C21.3137 12 24 14.6863 24 18Z"
                fill="#A9A9A9"
            />
            <path
                d="M16 20L14 24H18L16 28"
                stroke="#FFD700"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
        </svg>
    ),
);
