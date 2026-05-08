import { Typography } from '@signalco/ui-primitives/Typography';

const code128Patterns = [
    '212222',
    '222122',
    '222221',
    '121223',
    '121322',
    '131222',
    '122213',
    '122312',
    '132212',
    '221213',
    '221312',
    '231212',
    '112232',
    '122132',
    '122231',
    '113222',
    '123122',
    '123221',
    '223211',
    '221132',
    '221231',
    '213212',
    '223112',
    '312131',
    '311222',
    '321122',
    '321221',
    '312212',
    '322112',
    '322211',
    '212123',
    '212321',
    '232121',
    '111323',
    '131123',
    '131321',
    '112313',
    '132113',
    '132311',
    '211313',
    '231113',
    '231311',
    '112133',
    '112331',
    '132131',
    '113123',
    '113321',
    '133121',
    '313121',
    '211331',
    '231131',
    '213113',
    '213311',
    '213131',
    '311123',
    '311321',
    '331121',
    '312113',
    '312311',
    '332111',
    '314111',
    '221411',
    '431111',
    '111224',
    '111422',
    '121124',
    '121421',
    '141122',
    '141221',
    '112214',
    '112412',
    '122114',
    '122411',
    '142112',
    '142211',
    '241211',
    '221114',
    '413111',
    '241112',
    '134111',
    '111242',
    '121142',
    '121241',
    '114212',
    '124112',
    '124211',
    '411212',
    '421112',
    '421211',
    '212141',
    '214121',
    '412121',
    '111143',
    '111341',
    '131141',
    '114113',
    '114311',
    '411113',
    '411311',
    '113141',
    '114131',
    '311141',
    '411131',
    '211412',
    '211214',
    '211232',
    '2331112',
];

const startCodeB = 104;
const stopCode = 106;
const quietZoneModules = 10;

type BarcodeBar = {
    x: number;
    width: number;
};

function code128PatternIndexes(value: string) {
    const dataCodes: number[] = [];
    for (const character of value) {
        const charCode = character.charCodeAt(0);
        if (charCode < 32 || charCode > 126) {
            return null;
        }

        dataCodes.push(charCode - 32);
    }

    const checksum =
        (startCodeB +
            dataCodes.reduce(
                (total, code, index) => total + code * (index + 1),
                0,
            )) %
        103;

    return [startCodeB, ...dataCodes, checksum, stopCode];
}

function code128Bars(value: string) {
    const indexes = code128PatternIndexes(value);
    if (!indexes) {
        return null;
    }

    const bars: BarcodeBar[] = [];
    let x = quietZoneModules;

    for (const index of indexes) {
        const pattern = code128Patterns[index];
        for (const [partIndex, moduleWidth] of [...pattern].entries()) {
            const width = Number(moduleWidth);
            if (partIndex % 2 === 0) {
                bars.push({ x, width });
            }
            x += width;
        }
    }

    return {
        bars,
        width: x + quietZoneModules,
    };
}

export function BarcodeValue({ value }: { value: string }) {
    const barcode = code128Bars(value);

    return (
        <div className="inline-flex w-fit max-w-full flex-col items-start">
            {barcode && (
                <svg
                    role="img"
                    aria-label={`Barcode ${value}`}
                    viewBox={`0 0 ${barcode.width} 24`}
                    className="h-6 max-w-44 text-foreground"
                    style={{
                        width: `${Math.min(barcode.width * 1.5, 176)}px`,
                    }}
                    preserveAspectRatio="none"
                >
                    <title>{value}</title>
                    {barcode.bars.map((bar) => (
                        <rect
                            key={`${bar.x}-${bar.width}`}
                            x={bar.x}
                            y={0}
                            width={bar.width}
                            height={24}
                            fill="currentColor"
                            shapeRendering="crispEdges"
                        />
                    ))}
                </svg>
            )}
            <Typography
                level="body3"
                className="max-w-44 break-all self-center"
            >
                {value}
            </Typography>
        </div>
    );
}
