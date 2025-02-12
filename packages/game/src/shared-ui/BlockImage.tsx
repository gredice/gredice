import { HTMLAttributes } from "react";

export function BlockImage({ blockName, ...rest }: Omit<HTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & { blockName: string }) {
    return (
        <img
            src={`https://www.gredice.com/assets/blocks/${blockName}.png`}
            alt={blockName}
            {...rest}
        />
    );
}