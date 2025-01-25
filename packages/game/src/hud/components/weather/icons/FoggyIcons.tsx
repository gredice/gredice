import React from 'react'

const createDayNightIcon = (
    DayIcon: React.FC<React.SVGProps<SVGSVGElement>>,
    NightIcon: React.FC<React.SVGProps<SVGSVGElement>>
) => ({
    day: DayIcon,
    night: NightIcon,
})

export const SunnyAndFoggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="16" cy="10" r="6" fill="#FFD700" />
            <path d="M16 2V4M16 16V18M24 10H22M10 10H8M22 4L20 6M12 14L10 16M22 16L20 14M12 6L10 4" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 20H28M6 24H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M16 2C8.27 2 2 8.27 2 16C2 23.73 8.27 30 16 30C19.32 30 22.37 28.84 24.76 26.93C17.41 26.5 11.5 20.59 11.07 13.24C9.16 15.63 8 18.68 8 22C8 29.73 14.27 36 22 36" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 20H28M6 24H26M8 28H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const SunnyLightCloudsAndFoggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="16" cy="8" r="4" fill="#FFD700" />
            <path d="M16 2V4M16 12V14M22 8H20M12 8H10M20 4L18 6M14 10L12 12M20 12L18 10M14 6L12 4" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
            <path d="M24 16.5C24 18.9853 21.9853 21 19.5 21H10.5C8.01472 21 6 18.9853 6 16.5C6 14.0147 8.01472 12 10.5 12H19.5C21.9853 12 24 14.0147 24 16.5Z" fill="#E6E6E6" />
            <path d="M4 24H28M6 27H26M8 30H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M16 2C8.27 2 2 8.27 2 16C2 23.73 8.27 30 16 30C19.32 30 22.37 28.84 24.76 26.93C17.41 26.5 11.5 20.59 11.07 13.24C9.16 15.63 8 18.68 8 22C8 29.73 14.27 36 22 36" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24 16.5C24 18.9853 21.9853 21 19.5 21H10.5C8.01472 21 6 18.9853 6 16.5C6 14.0147 8.01472 12 10.5 12H19.5C21.9853 12 24 14.0147 24 16.5Z" fill="#A9A9A9" />
            <path d="M4 24H28M6 27H26M8 30H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const Foggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M4 12H28M6 16H26M8 20H24M10 24H22M12 28H20" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M4 12H28M6 16H26M8 20H24M10 24H22M12 28H20" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

export const CloudyMediumAndFoggy = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M28 14.5C28 18.6421 24.6421 22 20.5 22H7.5C3.35786 22 0 18.6421 0 14.5C0 10.3579 3.35786 7 7.5 7H20.5C24.6421 7 28 10.3579 28 14.5Z" fill="#E6E6E6" />
            <path d="M4 24H28M6 27H26M8 30H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M28 14.5C28 18.6421 24.6421 22 20.5 22H7.5C3.35786 22 0 18.6421 0 14.5C0 10.3579 3.35786 7 7.5 7H20.5C24.6421 7 28 10.3579 28 14.5Z" fill="#A9A9A9" />
            <path d="M4 24H28M6 27H26M8 30H24" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
)

