import React from 'react'

const createDayNightIcon = (
    DayIcon: React.FC<React.SVGProps<SVGSVGElement>>,
    NightIcon: React.FC<React.SVGProps<SVGSVGElement>>
) => ({
    day: DayIcon,
    night: NightIcon,
})

export const CloudyLightRain = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const CloudyMediumRain = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M8 26L7 29M16 26L15 29M24 26L23 29" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M8 26L7 29M16 26L15 29M24 26L23 29" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const CloudyHeavyRain = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const CloudyWithThunder = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
)

export const CloudyLightRainWithThunder = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
)

export const CloudyMediumRainWithThunder = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M8 26L7 29M16 26L15 29M24 26L23 29" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M8 26L7 29M16 26L15 29M24 26L23 29" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
)

export const CloudyHeavyRainWithThunder = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 22L14 26H18L16 30" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
)

export const CloudyLightSnowyRain = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    )
)

export const CloudyMediumSnowyRain = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M8 26L7 29M16 26L15 29M24 26L23 29" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="18" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M8 26L7 29M16 26L15 29M24 26L23 29" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="18" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    )
)

export const CloudyHeavySnowyRain = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="8" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="24" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M6 26L5 30M12 26L11 30M18 26L17 30M24 26L23 30" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="8" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="24" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    )
)

export const CloudyLightSnow = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
        </svg>
    )
)

export const CloudyMediumSnow = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="13" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="19" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="13" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="19" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    )
)

export const CloudyHeavySnow = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <circle cx="8" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="14" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="11" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="17" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="23" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <circle cx="8" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="14" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="20" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="11" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="17" cy="29" r="1" fill="#E6E6E6" />
            <circle cx="23" cy="29" r="1" fill="#E6E6E6" />
        </svg>
    )
)

export const SunnyMediumCloudsLightRainAndFoggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path d="M26 18C26 21.3137 23.3137 24 20 24H12C8.68629 24 6 21.3137 6 18C6 14.6863 8.68629 12 12 12H20C23.3137 12 26 14.6863 26 18Z" fill="#E6E6E6" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" />
            <path d="M26 18C26 21.3137 23.3137 24 20 24H12C8.68629 24 6 21.3137 6 18C6 14.6863 8.68629 12 12 12H20C23.3137 12 26 14.6863 26 18Z" fill="#A9A9A9" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const SunnyMediumCloudsLightSnowAndFoggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="16" cy="10" r="5" fill="#FFD700" />
            <path d="M26 18C26 21.3137 23.3137 24 20 24H12C8.68629 24 6 21.3137 6 18C6 14.6863 8.68629 12 12 12H20C23.3137 12 26 14.6863 26 18Z" fill="#E6E6E6" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M16 8C13.7909 8 12 9.79086 12 12C12 14.2091 13.7909 16 16 16C17.5194 16 18.8289 15.1956 19.5 14" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" />
            <path d="M26 18C26 21.3137 23.3137 24 20 24H12C8.68629 24 6 21.3137 6 18C6 14.6863 8.68629 12 12 12H20C23.3137 12 26 14.6863 26 18Z" fill="#A9A9A9" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const CloudyLightSnowAndFoggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <circle cx="10" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="16" cy="27" r="1" fill="#E6E6E6" />
            <circle cx="22" cy="27" r="1" fill="#E6E6E6" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const CloudyLightRainAndFoggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#E6E6E6" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M26 16C26 20.4183 22.4183 24 18 24H10C5.58172 24 2 20.4183 2 16C2 11.5817 5.58172 8 10 8H18C22.4183 8 26 11.5817 26 16Z" fill="#A9A9A9" />
            <path d="M10 26L9 28M16 26L15 28M22 26L21 28" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 22H28M6 25H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

