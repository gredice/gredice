import type { SVGProps } from 'react';

export function RaisedBedIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            fill="none"
            viewBox="0 0 500 500"
            {...props}
        >
            <title>Podignuta gredica</title>
            <path
                stroke="currentColor"
                strokeWidth={20}
                d="M42 191v118.5l208 122M42 191 250 68l210.5 123M42 191l208 118.5M460.5 191v118.5L250 431.5M460.5 191 250 309.5m0 122v-122m0-199L111.5 191l29 17.2M250 110.5 391.5 191l-31 17.2M250 110.5V143m-109.5 65.2L250 270.5l110.5-62.3m-220 0L250 143m0 0 110.5 65.2"
            />
        </svg>
    );
}
