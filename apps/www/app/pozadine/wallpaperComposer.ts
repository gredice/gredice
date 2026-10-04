export type WallpaperBranding = 'clean' | 'gredice';
export type WallpaperPhase = 'morning' | 'day' | 'evening' | 'night';
export type WallpaperSizeKey =
    | 'fullHd'
    | 'mobile'
    | 'tablet'
    | 'uhd'
    | 'ultrawide';
export type WallpaperTemplate = 'minimal' | 'standard';
export type WallpaperTheme = 'water' | 'grass' | 'sand' | 'dirt';

export const wallpaperSizes = {
    fullHd: {
        height: 1080,
        label: '1080p · 1920 × 1080',
        shortLabel: '1080p',
        width: 1920,
    },
    mobile: {
        height: 2796,
        label: 'Mobitel · 1290 × 2796',
        shortLabel: 'Mobitel',
        width: 1290,
    },
    tablet: {
        height: 2732,
        label: 'Tablet · 2048 × 2732',
        shortLabel: 'Tablet',
        width: 2048,
    },
    uhd: {
        height: 2160,
        label: '4K · 3840 × 2160',
        shortLabel: '4K',
        width: 3840,
    },
    ultrawide: {
        height: 1440,
        label: 'Ultrawide · 3440 × 1440',
        shortLabel: 'Ultrawide',
        width: 3440,
    },
} satisfies Record<
    WallpaperSizeKey,
    { height: number; label: string; shortLabel: string; width: number }
>;

export const wallpaperCaptureRenderScale = 1.5;
const wallpaperCaptureMaxDimension = 4096;

export function getWallpaperCaptureSize({
    height,
    width,
}: {
    height: number;
    width: number;
}) {
    const scale = Math.min(
        wallpaperCaptureRenderScale,
        wallpaperCaptureMaxDimension / height,
        wallpaperCaptureMaxDimension / width,
    );
    return {
        height: Math.round(height * scale),
        width: Math.round(width * scale),
    };
}

export const wallpaperPhaseLabels = {
    morning: 'Jutro',
    day: 'Dan',
    evening: 'Večer',
    night: 'Noć',
} satisfies Record<WallpaperPhase, string>;

export const wallpaperThemeLabels = {
    water: 'Voda',
    grass: 'Trava',
    sand: 'Pijesak',
    dirt: 'Zemlja',
} satisfies Record<WallpaperTheme, string>;

export const wallpaperTemplateLabels = {
    minimal: 'Minimalna',
    standard: 'U vrtu',
} satisfies Record<WallpaperTemplate, string>;

type WallpaperPalette = {
    end: string;
    field: string;
    logo: string;
    ring: string;
    start: string;
};

const themePalettes = {
    water: {
        end: '#d9efea',
        field: '#c4e5df',
        logo: '#236b65',
        ring: '#83bbb3',
        start: '#f2f8f4',
    },
    grass: {
        end: '#e1edd6',
        field: '#d4e8c6',
        logo: '#39734a',
        ring: '#9fc493',
        start: '#f4f7ee',
    },
    sand: {
        end: '#eadbbd',
        field: '#e6d2aa',
        logo: '#705c37',
        ring: '#c9ab74',
        start: '#faf5e8',
    },
    dirt: {
        end: '#e7cdc4',
        field: '#dfc0b4',
        logo: '#785044',
        ring: '#c89786',
        start: '#f8efeb',
    },
} satisfies Record<WallpaperTheme, WallpaperPalette>;

function hexToRgb(value: string) {
    const normalized = value.startsWith('#') ? value.slice(1) : value;
    return {
        blue: Number.parseInt(normalized.slice(4, 6), 16),
        green: Number.parseInt(normalized.slice(2, 4), 16),
        red: Number.parseInt(normalized.slice(0, 2), 16),
    };
}

function rgbToHex({ blue, green, red }: ReturnType<typeof hexToRgb>) {
    const channel = (value: number) =>
        Math.round(Math.min(255, Math.max(0, value)))
            .toString(16)
            .padStart(2, '0');
    return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function mixColor(left: string, right: string, amount: number) {
    const from = hexToRgb(left);
    const to = hexToRgb(right);
    return rgbToHex({
        blue: from.blue + (to.blue - from.blue) * amount,
        green: from.green + (to.green - from.green) * amount,
        red: from.red + (to.red - from.red) * amount,
    });
}

export function resolveWallpaperPalette(
    theme: WallpaperTheme,
    phase: WallpaperPhase,
): WallpaperPalette {
    const base = themePalettes[theme];
    if (phase === 'day') {
        return base;
    }

    if (phase === 'morning') {
        return {
            end: mixColor(base.end, '#f6c891', 0.2),
            field: mixColor(base.field, '#efbd7e', 0.16),
            logo: mixColor(base.logo, '#6e5239', 0.22),
            ring: mixColor(base.ring, '#d3a16d', 0.2),
            start: mixColor(base.start, '#fff0d8', 0.24),
        };
    }

    if (phase === 'evening') {
        return {
            end: mixColor(base.end, '#c98485', 0.3),
            field: mixColor(base.field, '#c87875', 0.24),
            logo: '#744b51',
            ring: mixColor(base.ring, '#a8666d', 0.32),
            start: mixColor(base.start, '#f3b39d', 0.32),
        };
    }

    return {
        end: mixColor(base.end, '#122033', 0.9),
        field: mixColor(base.field, '#19304a', 0.84),
        logo: '#dce8e3',
        ring: mixColor(base.ring, '#5c7693', 0.7),
        start: mixColor(base.start, '#1d3045', 0.88),
    };
}

export function getWallpaperPreviewSize(sizeKey: WallpaperSizeKey) {
    const size = wallpaperSizes[sizeKey];
    const scale = Math.min(1200 / size.width, 800 / size.height);
    return {
        height: Math.round(size.height * scale),
        width: Math.round(size.width * scale),
    };
}

export function wallpaperFileName({
    branding,
    phase,
    size,
    template,
}: {
    branding: WallpaperBranding;
    phase: WallpaperPhase;
    size: WallpaperSizeKey;
    template: WallpaperTemplate;
}) {
    const stem = [
        'gredice-vrt',
        template,
        phase,
        size,
        branding === 'gredice' ? 'potpis' : 'cista',
    ].join('-');
    return `${stem}.png`;
}

function ditherNoise(x: number, y: number) {
    let hash = Math.imul(x + 1, 374_761_393) ^ Math.imul(y + 1, 668_265_263);
    hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
    return ((hash ^ (hash >>> 16)) & 3) - 1.5;
}

function drawDitheredGradient(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    start: string,
    end: string,
) {
    const from = hexToRgb(start);
    const to = hexToRgb(end);
    const image = context.createImageData(width, height);
    const widthDenominator = Math.max(1, width - 1);
    const heightDenominator = Math.max(1, height - 1);

    for (let y = 0; y < height; y += 1) {
        const vertical = y / heightDenominator;
        for (let x = 0; x < width; x += 1) {
            const horizontal = x / widthDenominator;
            const amount = horizontal * 0.68 + vertical * 0.32;
            const noise = ditherNoise(x, y);
            const offset = (y * width + x) * 4;
            image.data[offset] = Math.round(
                from.red + (to.red - from.red) * amount + noise,
            );
            image.data[offset + 1] = Math.round(
                from.green + (to.green - from.green) * amount + noise,
            );
            image.data[offset + 2] = Math.round(
                from.blue + (to.blue - from.blue) * amount + noise,
            );
            image.data[offset + 3] = 255;
        }
    }

    context.putImageData(image, 0, 0);
}

function applyDither(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
) {
    const image = context.getImageData(0, 0, width, height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            const noise = ditherNoise(x, y) * 0.65;
            image.data[offset] += noise;
            image.data[offset + 1] += noise;
            image.data[offset + 2] += noise;
        }
    }
    context.putImageData(image, 0, 0);
}

function loadHtmlImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Slika se nije mogla učitati.'));
        image.src = url;
    });
}

async function loadBlobImage(blob: Blob) {
    if (typeof window.createImageBitmap === 'function') {
        return window.createImageBitmap(blob);
    }

    const url = URL.createObjectURL(blob);
    try {
        return await loadHtmlImage(url);
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function loadLogo(color: string) {
    const sourceElement = document.querySelector(
        '[data-wallpaper-logo-source]',
    );
    if (!(sourceElement instanceof SVGElement)) {
        throw new Error('Gredice logotip nije dostupan.');
    }

    const logoElement = sourceElement.cloneNode(true);
    if (!(logoElement instanceof SVGElement)) {
        throw new Error('Gredice logotip nije dostupan.');
    }
    logoElement.removeAttribute('class');
    logoElement.removeAttribute('data-wallpaper-logo-source');
    for (const element of logoElement.querySelectorAll('g, path')) {
        element.removeAttribute('class');
        element.setAttribute('fill', color);
    }
    const source = new XMLSerializer().serializeToString(logoElement);
    const url = URL.createObjectURL(
        new Blob([source], { type: 'image/svg+xml' }),
    );
    try {
        return await loadHtmlImage(url);
    } finally {
        URL.revokeObjectURL(url);
    }
}

export function getMinimalGardenPlacement({
    height,
    width,
}: {
    height: number;
    width: number;
}) {
    // The capture camera targets the garden's world-space center. Keep that
    // stable horizontal anchor instead of recentering from shadows or tall
    // plants in the transparent pixels, then lower it to reserve more sky.
    const captureCenter = {
        x: width / 2,
        y: height / 2,
    };
    const wallpaperTarget = {
        x: width / 2,
        y: height * 0.62,
    };

    return {
        offsetX: wallpaperTarget.x - captureCenter.x,
        offsetY: wallpaperTarget.y - captureCenter.y,
    };
}

function canvasToPng(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            reject(new Error('PNG datoteka nije mogla biti izrađena.'));
        }, 'image/png');
    });
}

export async function composeWallpaper({
    branding,
    height,
    phase,
    scene,
    template,
    theme,
    width,
}: {
    branding: WallpaperBranding;
    height: number;
    phase: WallpaperPhase;
    scene: Blob;
    template: WallpaperTemplate;
    theme: WallpaperTheme;
    width: number;
}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Tvoj preglednik ne podržava izradu pozadine.');
    }

    const palette = resolveWallpaperPalette(theme, phase);
    const sceneImage = await loadBlobImage(scene);

    try {
        if (template === 'minimal') {
            drawDitheredGradient(
                context,
                width,
                height,
                palette.start,
                palette.end,
            );

            context.save();
            context.globalAlpha = 0.68;
            context.fillStyle = palette.field;
            context.beginPath();
            context.ellipse(
                width * 0.5,
                height * 0.72,
                width * 0.36,
                height * 0.28,
                0,
                0,
                Math.PI * 2,
            );
            context.fill();
            context.globalAlpha = 0.42;
            context.strokeStyle = palette.ring;
            context.lineWidth = Math.max(1, width / 2400);
            context.beginPath();
            context.ellipse(
                width * 0.5,
                height * 0.72,
                width * 0.31,
                height * 0.225,
                0,
                0,
                Math.PI * 2,
            );
            context.stroke();
            context.restore();

            const { offsetX, offsetY } = getMinimalGardenPlacement({
                height,
                width,
            });
            context.drawImage(sceneImage, offsetX, offsetY, width, height);
        } else {
            context.drawImage(sceneImage, 0, 0, width, height);
            applyDither(context, width, height);
        }
    } finally {
        if (
            typeof ImageBitmap !== 'undefined' &&
            sceneImage instanceof ImageBitmap
        ) {
            sceneImage.close();
        }
    }

    if (branding === 'gredice') {
        const logo = await loadLogo(palette.logo);
        const logoWidth = Math.round(width * 0.24);
        const logoHeight = Math.round((logoWidth * 44) / 163);
        const horizontalMargin = width * 0.04;
        const verticalMargin = height * 0.04;
        const logoLeft = width - horizontalMargin - logoWidth;
        const logoTop = height - verticalMargin - logoHeight;
        context.globalAlpha = phase === 'night' ? 0.86 : 0.72;
        context.drawImage(logo, logoLeft, logoTop, logoWidth, logoHeight);
        context.globalAlpha = 1;
    }

    return canvasToPng(canvas);
}
