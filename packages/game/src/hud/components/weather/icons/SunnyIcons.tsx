import React from 'react'

const createDayNightIcon = (
    DayIcon: React.FC<React.SVGProps<SVGSVGElement>>,
    NightIcon: React.FC<React.SVGProps<SVGSVGElement>>
) => ({
    day: DayIcon,
    night: NightIcon,
})

export const Sunny = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="16" cy="16" r="8" fill="#FFD700" />
            <path d="M16 3V6M16 26V29M29 16H26M6 16H3M25.5 6.5L23.4 8.6M8.6 23.4L6.5 25.5M25.5 25.5L23.4 23.4M8.6 8.6L6.5 6.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M16 2C8.27 2 2 8.27 2 16C2 23.73 8.27 30 16 30C19.32 30 22.37 28.84 24.76 26.93C17.41 26.5 11.5 20.59 11.07 13.24C9.16 15.63 8 18.68 8 22C8 29.73 14.27 36 22 36" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
)

export const SunnyLightClouds = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="16" cy="14" r="6" fill="#FFD700" />
            <path d="M16 5V7M16 21V23M25 14H23M9 14H7M22.5 7.5L21 9M11 19L9.5 20.5M22.5 20.5L21 19M11 9L9.5 7.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
            <path d="M24 20.5C24 22.9853 21.9853 25 19.5 25H10.5C8.01472 25 6 22.9853 6 20.5C6 18.0147 8.01472 16 10.5 16H19.5C21.9853 16 24 18.0147 24 20.5Z" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M16 2C8.27 2 2 8.27 2 16C2 23.73 8.27 30 16 30C19.32 30 22.37 28.84 24.76 26.93C17.41 26.5 11.5 20.59 11.07 13.24C9.16 15.63 8 18.68 8 22C8 29.73 14.27 36 22 36" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24 20.5C24 22.9853 21.9853 25 19.5 25H10.5C8.01472 25 6 22.9853 6 20.5C6 18.0147 8.01472 16 10.5 16H19.5C21.9853 16 24 18.0147 24 20.5Z" fill="#A9A9A9" />
        </svg>
    )
)

export const SunnyMediumClouds = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="14" cy="12" r="5" fill="#FFD700" />
            <path d="M14 4V6M14 18V20M22 12H20M8 12H6M19.5 6.5L18 8M10 16L8.5 17.5M19.5 17.5L18 16M10 8L8.5 6.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
            <path d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M14 2C6.27 2 0 8.27 0 16C0 23.73 6.27 30 14 30C17.32 30 20.37 28.84 22.76 26.93C15.41 26.5 9.5 20.59 9.07 13.24C7.16 15.63 6 18.68 6 22C6 29.73 12.27 36 20 36" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M26 20.5C26 23.5376 23.5376 26 20.5 26H9.5C6.46243 26 4 23.5376 4 20.5C4 17.4624 6.46243 15 9.5 15H20.5C23.5376 15 26 17.4624 26 20.5Z" fill="#A9A9A9" />
        </svg>
    )
)

export const SunnyHeavyClouds = createDayNightIcon(
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="12" cy="10" r="4" fill="#FFD700" />
            <path d="M12 3V5M12 15V17M19 10H17M7 10H5M16.5 5.5L15 7M9 13L7.5 14.5M16.5 14.5L15 13M9 7L7.5 5.5" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
            <path d="M28 20.5C28 24.6421 24.6421 28 20.5 28H7.5C3.35786 28 0 24.6421 0 20.5C0 16.3579 3.35786 13 7.5 13H20.5C24.6421 13 28 16.3579 28 20.5Z" fill="#E6E6E6" />
        </svg>
    ),
    (props) => (
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <path d="M12 2C4.27 2 -2 8.27 -2 16C-2 23.73 4.27 30 12 30C15.32 30 18.37 28.84 20.76 26.93C13.41 26.5 7.5 20.59 7.07 13.24C5.16 15.63 4 18.68 4 22C4 29.73 10.27 36 18 36" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M28 20.5C28 24.6421 24.6421 28 20.5 28H7.5C3.35786 28 0 24.6421 0 20.5C0 16.3579 3.35786 13 7.5 13H20.5C24.6421 13 28 16.3579 28 20.5Z" fill="#A9A9A9" />
        </svg>
    )
)

