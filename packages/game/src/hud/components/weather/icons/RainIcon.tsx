import React from 'react'

type RainIconProps = {
    chance: number
}

export const RainIcon: React.FC<RainIconProps> = ({ chance }) => {
    const fillPercentage = Math.min(chance, 100)
    return (
        <div className="relative w-4 h-4">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                className="absolute inset-0 text-gray-300"
            >
                <path
                    d="M12 21.5C16 21.5 18.5 19 18.5 15.5C18.5 13.5 16 8.5 12 3.5C8 8.5 5.5 13.5 5.5 15.5C5.5 19 8 21.5 12 21.5Z"
                    fill="currentColor"
                />
            </svg>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                className="absolute inset-0"
                style={{
                    clipPath: `inset(${100 - fillPercentage}% 0 0 0)`
                }}
            >
                <path
                    d="M12 21.5C16 21.5 18.5 19 18.5 15.5C18.5 13.5 16 8.5 12 3.5C8 8.5 5.5 13.5 5.5 15.5C5.5 19 8 21.5 12 21.5Z"
                    fill="#4A90E2"
                />
            </svg>
        </div>
    )
}

