import { HtmlHTMLAttributes } from "react";

// TODO: Refactor into shared package since we have this 2-3 times already
export function BlockImage({ blockName, width, height, ...rest }: Omit<HtmlHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & { blockName: string, width: number, height: number }) {
    return (
        <img
            src={`https://www.gredice.com/assets/blocks/${blockName}.png`}
            alt={blockName}
            width={width}
            height={height}
            {...rest}
        />
    );
}
