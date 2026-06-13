import { create as createQrCode } from 'qrcode';
import {
    discardedDocumentationPages,
    documentationChangeLabel,
    type FarmerDocumentationPackage,
    type FarmerDocumentationPage,
    formatDocumentationDateTime,
    getFarmerAppOrigin,
    includedDocumentationPages,
} from './farmerDocumentationData';

type PdfFontKey = 'F1' | 'F2';

type PdfColor = {
    r: number;
    g: number;
    b: number;
};

type PdfTransform = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
};

type HeaderData = {
    code: string;
    title: string;
    subtitle: string;
    qrUrl: string;
    version: string;
    generatedAt: Date;
};

type FlowContext = {
    page: PdfCanvas;
    pages: PdfCanvas[];
    header: HeaderData;
    y: number;
};

const colors = {
    brand: { r: 0.18, g: 0.44, b: 0.25 },
    text: { r: 0.09, g: 0.1, b: 0.12 },
    muted: { r: 0.42, g: 0.45, b: 0.5 },
    line: { r: 0.86, g: 0.88, b: 0.9 },
    softGreen: { r: 0.94, g: 0.97, b: 0.94 },
    softGray: { r: 0.97, g: 0.98, b: 0.96 },
    white: { r: 1, g: 1, b: 1 },
    black: { r: 0, g: 0, b: 0 },
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 36;
const headerHeight = 102;
const bottomY = 42;
const contentWidth = pageWidth - margin * 2;
const bodyFontSize = 9.4;
const bodyLineHeight = 13.2;
const smallFontSize = 7.8;
const titleFontSize = 17;
const logoWordmarkFontSize = 18.75;
const logoWordmarkStrokeWidth = 0.16;

const logoMarkPaths = [
    '0 19 m 0 18.448 0.264 18 0.591 18 c 29.41 18 l 29.736 18 30 18.448 30 19 c 30 19.552 29.736 20 29.41 20 c 0.591 20 l 0.264 20 0 19.552 0 19 c h',
    '0 24 m 0 23.448 0.264 23 0.591 23 c 29.41 23 l 29.736 23 30 23.448 30 24 c 30 24.552 29.736 25 29.41 25 c 0.591 25 l 0.264 25 0 24.552 0 24 c h',
    '0 29 m 0 28.448 0.264 28 0.591 28 c 29.41 28 l 29.736 28 30 28.448 30 29 c 30 29.552 29.736 30 29.41 30 c 0.591 30 l 0.264 30 0 29.552 0 29 c h',
    '6.914 6.986 m 6.914 18.47 l 5.742 18.47 l 5.742 6.986 l 6.914 6.986 l h',
    '6.226 1 m 6.707 1.468 l 7.195 1.941 7.571 2.361 7.81 2.819 c 8.061 3.301 8.14 3.783 8.115 4.346 c 8.114 4.374 l 8.11 4.401 l 8.038 4.915 7.947 5.371 7.733 5.83 c 7.519 6.291 7.199 6.717 6.722 7.215 c 6.305 7.65 l 5.882 7.221 l 5.431 6.764 5.117 6.35 4.913 5.877 c 4.711 5.405 4.639 4.92 4.601 4.359 c 4.599 4.326 l 4.6 4.293 l 4.646 3.283 5.036 2.613 5.827 1.54 c 6.226 1 l h 6.368 2.803 m 5.937 3.446 5.8 3.82 5.773 4.314 c 5.807 4.807 5.868 5.13 5.99 5.415 c 6.06 5.577 6.156 5.742 6.297 5.926 c 6.47 5.706 6.586 5.517 6.671 5.336 c 6.808 5.042 6.879 4.731 6.945 4.266 c 6.96 3.875 6.903 3.614 6.771 3.361 c 6.684 3.193 6.556 3.015 6.368 2.803 c h',
    '1.592 5.524 m 1.617 6.194 l 1.643 6.874 1.703 7.434 1.884 7.918 c 2.074 8.427 2.379 8.809 2.815 9.167 c 2.836 9.184 l 2.859 9.199 l 3.289 9.49 3.688 9.727 4.173 9.876 c 4.658 10.025 5.189 10.073 5.879 10.051 c 6.481 10.032 l 6.445 9.431 l 6.408 8.79 6.31 8.279 6.094 7.812 c 5.879 7.346 5.567 6.967 5.175 6.564 c 5.152 6.54 l 5.127 6.519 l 4.345 5.877 3.587 5.719 2.26 5.589 c 1.592 5.524 l h 2.836 6.836 m 3.603 6.946 3.973 7.094 4.358 7.405 c 4.702 7.76 4.901 8.022 5.03 8.303 c 5.105 8.463 5.162 8.645 5.205 8.873 c 4.926 8.855 4.708 8.814 4.517 8.756 c 4.206 8.661 3.927 8.506 3.538 8.244 c 3.238 7.993 3.082 7.776 2.982 7.509 c 2.916 7.332 2.869 7.118 2.836 6.836 c h',
    '10.436 8.51 m 10.469 9.181 l 10.503 9.86 10.492 10.423 10.354 10.921 c 10.209 11.445 9.938 11.852 9.535 12.246 c 9.516 12.265 l 9.494 12.282 l 9.091 12.61 8.714 12.881 8.244 13.071 c 7.774 13.262 7.249 13.356 6.56 13.394 c 5.959 13.428 l 5.942 12.826 l 5.923 12.184 5.976 11.667 6.15 11.182 c 6.324 10.699 6.602 10.295 6.957 9.859 c 6.978 9.833 l 7.001 9.81 l 7.724 9.103 8.466 8.879 9.776 8.634 c 10.436 8.51 l h 9.311 9.926 m 8.556 10.102 8.201 10.282 7.844 10.625 c 7.533 11.01 7.358 11.287 7.253 11.579 c 7.193 11.745 7.151 11.931 7.129 12.162 c 7.405 12.119 7.619 12.06 7.804 11.985 c 8.105 11.863 8.369 11.684 8.735 11.39 c 9.012 11.114 9.148 10.884 9.225 10.609 c 9.275 10.427 9.303 10.21 9.311 9.926 c h',
    '0.585 14.028 m 0.881 14.631 l 1.181 15.241 1.464 15.729 1.826 16.097 c 2.206 16.485 2.64 16.709 3.184 16.859 c 3.21 16.866 l 3.237 16.871 l 3.749 16.962 4.21 17.016 4.713 16.955 c 5.217 16.893 5.722 16.721 6.343 16.421 c 6.885 16.159 l 6.608 15.624 l 6.313 15.054 6.016 14.627 5.629 14.287 c 5.243 13.949 4.804 13.73 4.281 13.521 c 4.251 13.509 l 4.219 13.5 l 3.244 13.232 2.487 13.396 1.222 13.816 c 0.585 14.028 l h 2.255 14.721 m 3.001 14.509 3.399 14.495 3.877 14.622 c 4.336 14.807 4.624 14.965 4.857 15.169 c 4.99 15.285 5.116 15.428 5.248 15.619 c 4.985 15.715 4.77 15.767 4.571 15.791 c 4.249 15.831 3.931 15.803 3.469 15.722 c 3.093 15.615 2.862 15.481 2.662 15.277 c 2.53 15.142 2.4 14.966 2.255 14.721 c h',
    '26.426 6.986 m 26.426 18.47 l 25.254 18.47 l 25.254 6.986 l 26.426 6.986 l h',
    '25.738 1 m 26.219 1.468 l 26.706 1.941 27.083 2.361 27.322 2.819 c 27.573 3.301 27.652 3.783 27.627 4.346 c 27.625 4.374 l 27.621 4.401 l 27.549 4.915 27.459 5.371 27.245 5.83 c 27.031 6.291 26.711 6.717 26.234 7.215 c 25.817 7.65 l 25.394 7.221 l 24.942 6.764 24.628 6.35 24.425 5.877 c 24.223 5.405 24.15 4.92 24.113 4.359 c 24.111 4.326 l 24.112 4.293 l 24.158 3.283 24.548 2.613 25.339 1.54 c 25.738 1 l h 25.88 2.803 m 25.448 3.446 25.312 3.82 25.284 4.314 c 25.319 4.807 25.38 5.13 25.502 5.415 c 25.572 5.577 25.668 5.742 25.809 5.926 c 25.982 5.706 26.098 5.517 26.182 5.336 c 26.319 5.042 26.391 4.731 26.457 4.266 c 26.472 3.875 26.415 3.614 26.283 3.361 c 26.195 3.193 26.068 3.015 25.88 2.803 c h',
    '21.104 5.524 m 21.129 6.194 l 21.155 6.874 21.215 7.434 21.396 7.918 c 21.585 8.427 21.891 8.809 22.327 9.167 c 22.348 9.184 l 22.371 9.199 l 22.801 9.49 23.2 9.727 23.685 9.876 c 24.17 10.025 24.701 10.073 25.391 10.051 c 25.993 10.032 l 25.957 9.431 l 25.92 8.79 25.822 8.279 25.606 7.812 c 25.391 7.346 25.079 6.967 24.687 6.564 c 24.664 6.54 l 24.639 6.519 l 23.857 5.877 23.099 5.719 21.772 5.589 c 21.104 5.524 l h 22.348 6.836 m 23.115 6.946 23.485 7.094 23.87 7.405 c 24.213 7.76 24.413 8.022 24.542 8.303 c 24.616 8.463 24.674 8.645 24.717 8.873 c 24.438 8.855 24.22 8.814 24.029 8.756 c 23.718 8.661 23.439 8.506 23.05 8.244 c 22.75 7.993 22.593 7.776 22.494 7.509 c 22.427 7.332 22.381 7.118 22.348 6.836 c h',
    '29.948 8.51 m 29.981 9.181 l 30.015 9.86 30.003 10.423 29.866 10.921 c 29.721 11.445 29.45 11.852 29.047 12.246 c 29.027 12.265 l 29.006 12.282 l 28.602 12.61 28.226 12.881 27.756 13.071 c 27.285 13.262 26.76 13.356 26.072 13.394 c 25.47 13.428 l 25.453 12.826 l 25.435 12.184 25.488 11.667 25.662 11.182 c 25.835 10.699 26.113 10.295 26.469 9.859 c 26.49 9.833 l 26.513 9.81 l 27.236 9.103 27.978 8.879 29.288 8.634 c 29.948 8.51 l h 28.823 9.926 m 28.068 10.102 27.713 10.282 27.356 10.625 c 27.045 11.01 26.869 11.287 26.765 11.579 c 26.705 11.745 26.663 11.931 26.64 12.162 c 26.917 12.119 27.131 12.06 27.316 11.985 c 27.617 11.863 27.881 11.684 28.246 11.39 c 28.524 11.114 28.66 10.884 28.736 10.609 c 28.787 10.427 28.815 10.21 28.823 9.926 c h',
    '20.097 14.028 m 20.393 14.631 l 20.692 15.241 20.976 15.729 21.337 16.097 c 21.718 16.485 22.152 16.709 22.695 16.859 c 22.722 16.866 l 22.749 16.871 l 23.261 16.962 23.722 17.016 24.225 16.955 c 24.729 16.893 25.234 16.721 25.855 16.421 c 26.397 16.159 l 26.12 15.624 l 25.825 15.054 25.528 14.627 25.14 14.287 c 24.755 13.949 24.315 13.73 23.793 13.521 c 23.763 13.509 l 23.731 13.5 l 22.756 13.232 21.998 13.396 20.734 13.816 c 20.097 14.028 l h 21.767 14.721 m 22.513 14.509 22.91 14.495 23.389 14.622 c 23.847 14.807 24.135 14.965 24.368 15.169 c 24.501 15.285 24.628 15.428 24.76 15.619 c 24.497 15.715 24.282 15.767 24.083 15.791 c 23.761 15.831 23.443 15.803 22.981 15.722 c 22.605 15.615 22.374 15.481 22.174 15.277 c 22.041 15.142 21.912 14.966 21.767 14.721 c h',
    '15.943 9.97 m 15.943 18.47 l 14.771 18.47 l 14.771 9.97 l 15.943 9.97 l h',
    '15.249 4.164 m 15.73 4.632 l 16.218 5.105 16.595 5.525 16.833 5.983 c 17.084 6.465 17.163 6.947 17.138 7.51 c 17.137 7.538 l 17.133 7.565 l 17.061 8.079 16.97 8.535 16.756 8.995 c 16.542 9.455 16.223 9.882 15.745 10.379 c 15.328 10.814 l 14.905 10.385 l 14.454 9.928 14.14 9.514 13.937 9.041 c 13.734 8.57 13.662 8.084 13.624 7.523 c 13.622 7.49 l 13.624 7.457 l 13.669 6.447 14.059 5.777 14.851 4.704 c 15.249 4.164 l h 15.392 5.967 m 14.96 6.61 14.823 6.984 14.796 7.478 c 14.831 7.972 14.891 8.294 15.014 8.579 c 15.083 8.741 15.179 8.906 15.32 9.09 c 15.494 8.87 15.61 8.681 15.694 8.5 c 15.831 8.206 15.902 7.895 15.968 7.43 c 15.983 7.039 15.926 6.778 15.794 6.525 c 15.707 6.357 15.579 6.179 15.392 5.967 c h',
    '10.361 10.036 m 10.445 10.702 l 10.529 11.376 10.638 11.929 10.86 12.396 c 11.094 12.886 11.431 13.24 11.896 13.558 c 11.919 13.574 l 11.943 13.587 l 12.398 13.839 12.816 14.041 13.312 14.147 c 13.808 14.252 14.341 14.254 15.026 14.172 c 15.624 14.101 l 15.537 13.505 l 15.443 12.87 15.301 12.37 15.046 11.922 c 14.791 11.477 14.447 11.127 14.021 10.759 c 13.996 10.738 l 13.969 10.719 l 13.135 10.148 12.365 10.056 11.032 10.043 c 10.361 10.036 l h 11.715 11.235 m 12.489 11.277 12.869 11.393 13.28 11.668 c 13.654 11.993 13.875 12.236 14.028 12.505 c 14.116 12.658 14.19 12.834 14.252 13.057 c 13.972 13.063 13.752 13.042 13.556 13.001 c 13.239 12.933 12.947 12.803 12.537 12.576 c 12.216 12.353 12.041 12.15 11.918 11.892 c 11.837 11.721 11.772 11.512 11.715 11.235 c h',
    '20.486 13.455 m 20.334 14.108 l 20.179 14.77 20.013 15.309 19.743 15.75 c 19.46 16.213 19.087 16.529 18.591 16.797 c 18.567 16.811 l 18.542 16.821 l 18.063 17.025 17.627 17.181 17.122 17.235 c 16.617 17.288 16.087 17.234 15.414 17.081 c 14.827 16.948 l 14.976 16.364 l 15.136 15.742 15.329 15.26 15.63 14.842 c 15.93 14.426 16.309 14.113 16.771 13.792 c 16.798 13.773 l 16.827 13.758 l 17.716 13.277 18.491 13.266 19.818 13.392 c 20.486 13.455 l h 19.015 14.506 m 18.241 14.467 17.85 14.542 17.412 14.774 c 17.007 15.057 16.762 15.276 16.581 15.527 c 16.477 15.671 16.386 15.838 16.301 16.053 c 16.578 16.088 16.8 16.091 16.999 16.07 c 17.322 16.035 17.625 15.936 18.057 15.754 c 18.4 15.565 18.594 15.382 18.744 15.138 c 18.842 14.977 18.929 14.776 19.015 14.506 c h',
] as const;

const croatianReplacements: Record<string, string> = {
    '\u010c': 'C',
    '\u010d': 'c',
    '\u0106': 'C',
    '\u0107': 'c',
    '\u0110': 'Dj',
    '\u0111': 'dj',
    '\u0160': 'S',
    '\u0161': 's',
    '\u017d': 'Z',
    '\u017e': 'z',
};

class PdfCanvas {
    private readonly operations: string[] = [];

    text({
        x,
        y,
        value,
        size,
        font = 'F1',
        color = colors.text,
        strokeWidth,
    }: {
        x: number;
        y: number;
        value: string;
        size: number;
        font?: PdfFontKey;
        color?: PdfColor;
        strokeWidth?: number;
    }) {
        const strokeOperations =
            strokeWidth !== undefined
                ? [`${formatColor(color)} RG`, `${formatNumber(strokeWidth)} w`]
                : [];
        const textRenderingMode =
            strokeWidth !== undefined ? `${formatNumber(2)} Tr` : null;

        this.operations.push(
            [
                'q',
                `${formatColor(color)} rg`,
                ...strokeOperations,
                `BT /${font} ${formatNumber(size)} Tf 1 0 0 1 ${formatNumber(
                    x,
                )} ${formatNumber(
                    y,
                )} Tm ${textRenderingMode ?? ''} (${escapePdfText(value)}) Tj ET`,
                'Q',
            ].join(' '),
        );
    }

    line({
        x1,
        y1,
        x2,
        y2,
        color = colors.line,
        width = 0.6,
    }: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        color?: PdfColor;
        width?: number;
    }) {
        this.operations.push(
            [
                'q',
                `${formatColor(color)} RG`,
                `${formatNumber(width)} w`,
                `${formatNumber(x1)} ${formatNumber(y1)} m`,
                `${formatNumber(x2)} ${formatNumber(y2)} l S`,
                'Q',
            ].join(' '),
        );
    }

    fillRect({
        x,
        y,
        width,
        height,
        color,
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: PdfColor;
    }) {
        this.operations.push(
            [
                'q',
                `${formatColor(color)} rg`,
                `${formatNumber(x)} ${formatNumber(y)} ${formatNumber(
                    width,
                )} ${formatNumber(height)} re f`,
                'Q',
            ].join(' '),
        );
    }

    path({
        commands,
        color,
        transform,
    }: {
        commands: string;
        color: PdfColor;
        transform?: PdfTransform;
    }) {
        const transformOperation = transform
            ? `${formatNumber(transform.a)} ${formatNumber(
                  transform.b,
              )} ${formatNumber(transform.c)} ${formatNumber(
                  transform.d,
              )} ${formatNumber(transform.e)} ${formatNumber(transform.f)} cm`
            : null;
        this.operations.push(
            [
                'q',
                `${formatColor(color)} rg`,
                transformOperation,
                commands,
                'f',
                'Q',
            ]
                .filter((operation): operation is string => operation !== null)
                .join(' '),
        );
    }

    toString() {
        return this.operations.join('\n');
    }
}

export function generateFarmerDocumentationPdf(
    data: FarmerDocumentationPackage,
): ArrayBuffer {
    const farmOrigin = getFarmerAppOrigin();
    const version = farmerDocumentationVersion(data.generatedAt);
    const pages: PdfCanvas[] = [];

    drawOrganizationGuide({ data, farmOrigin, pages, version });

    for (const page of includedDocumentationPages(data)) {
        drawDocumentationPage({ data, farmOrigin, pages, version, page });
    }

    return writePdf(pages.map((page) => page.toString()));
}

export function farmerDocumentationFilename(data: FarmerDocumentationPackage) {
    const datePart = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(data.generatedAt);
    const scopePart = data.since ? 'promjene' : 'sve-stranice';

    return `farmeri-dokumentacija-${scopePart}-${datePart}.pdf`;
}

export function farmerDocumentationVersion(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    })
        .formatToParts(date)
        .reduce<Record<string, string>>((result, part) => {
            result[part.type] = part.value;
            return result;
        }, {});

    return `DOK-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function drawOrganizationGuide({
    data,
    farmOrigin,
    pages,
    version,
}: {
    data: FarmerDocumentationPackage;
    farmOrigin: string;
    pages: PdfCanvas[];
    version: string;
}) {
    let context = startPage(pages, {
        code: 'ORG-GUIDE',
        title: 'Vodic za organizaciju',
        subtitle: data.since
            ? `Promjene od ${formatDocumentationDateTime(data.since)}`
            : 'Cijeli prirucnik',
        qrUrl: farmOrigin,
        version,
        generatedAt: data.generatedAt,
    });
    const packageType = data.since
        ? 'Paket sadrzi organizacijski vodic i sve prirucnike promijenjene od zadnjeg ispisa.'
        : 'Paket sadrzi organizacijski vodic i sve trenutno objavljene prirucnike.';
    const includedPages = includedDocumentationPages(data);
    const discardedPages = discardedDocumentationPages(data);

    context = drawSection(context, 'Svrha paketa', [
        packageType,
        'Stranice nisu numerirane. U registratoru ih drzi abecedno prema naslovu stranice, odnosno velikom naslovu u zaglavlju.',
        'Ako dvije stranice imaju isti naslov, zadrzi redoslijed prema kodu.',
        'Kod dodavanja ili zamjene stranica novu verziju umetni na mjesto navedeno u uputama ispod.',
    ]);

    context = drawActionList(
        context,
        'Umetni nove stranice',
        includedPages.filter((page) => page.changeType === 'insert'),
        includedPages,
    );
    context = drawActionList(
        context,
        'Zamijeni postojece stranice',
        includedPages.filter((page) => page.changeType === 'replace'),
        includedPages,
    );
    context = drawDiscardList(context, discardedPages);
    context = drawSection(context, 'Kontrola nakon umetanja', [
        '1. Provjeri da je svaka nova ili zamijenjena stranica umetnuta na navedeno abecedno mjesto i da kod odgovara kodu u ovom vodicu.',
        '2. Stare stranice iz odjeljka za zamjenu izdvoji i odbaci nakon sto nova verzija stoji u registratoru.',
        '3. Stranice iz odjeljka za uklanjanje izvadi iz registratora bez zamjenske stranice.',
        '4. QR kod na svakoj stranici vodi na farmer aplikaciju za aktualnu digitalnu verziju prirucnika.',
    ]);

    drawFooter(context.page);
}

function drawActionList(
    context: FlowContext,
    title: string,
    pages: FarmerDocumentationPage[],
    allPages: FarmerDocumentationPage[],
) {
    if (pages.length === 0) {
        return drawSection(context, title, ['Nema stranica u ovoj skupini.']);
    }

    return drawSection(
        context,
        title,
        pages.map(
            (page) =>
                `${page.code} - ${page.label} [${page.documentTypeLabel}] - ${pagePlacementInstruction(page, allPages)} (${page.revisionActions.join(', ') || 'aktualna verzija'})`,
        ),
    );
}

function pagePlacementInstruction(
    page: FarmerDocumentationPage,
    allPages: FarmerDocumentationPage[],
) {
    const pageIndex = allPages.findIndex(
        (candidate) =>
            candidate.entityTypeName === page.entityTypeName &&
            candidate.id === page.id,
    );
    const previousPage = pageIndex > 0 ? allPages[pageIndex - 1] : null;
    const nextPage =
        pageIndex >= 0 && pageIndex < allPages.length - 1
            ? allPages[pageIndex + 1]
            : null;

    if (previousPage && nextPage) {
        return `abecedno izmedju ${pageReference(previousPage)} i ${pageReference(nextPage)}`;
    }
    if (nextPage) {
        return `abecedno prije ${pageReference(nextPage)}`;
    }
    if (previousPage) {
        return `abecedno poslije ${pageReference(previousPage)}`;
    }

    return 'jedina stranica u abecednom redoslijedu';
}

function pageReference(page: FarmerDocumentationPage) {
    return `${page.code} - ${page.label}`;
}

function drawDiscardList(
    context: FlowContext,
    discardedPages: ReturnType<typeof discardedDocumentationPages>,
) {
    if (discardedPages.length === 0) {
        return drawSection(context, 'Ukloni bez zamjene', [
            'Nema stranica za uklanjanje.',
        ]);
    }

    return drawSection(
        context,
        'Ukloni bez zamjene',
        discardedPages.map(
            (page) =>
                `${page.code} - ${page.label} [${page.documentTypeLabel}] (${page.revisionActions.join(', ')})`,
        ),
    );
}

function drawDocumentationPage({
    data,
    farmOrigin,
    page,
    pages,
    version,
}: {
    data: FarmerDocumentationPackage;
    farmOrigin: string;
    page: FarmerDocumentationPage;
    pages: PdfCanvas[];
    version: string;
}) {
    let context = startPage(pages, {
        code: page.code,
        title: page.label,
        subtitle: data.since
            ? `${page.documentTypeLabel} - ${documentationChangeLabel(page.changeType)}`
            : page.documentTypeLabel,
        qrUrl: `${farmOrigin}${page.appPath}`,
        version,
        generatedAt: data.generatedAt,
    });

    context = drawPageSummary(context, page);

    for (const section of page.sections) {
        context = drawSection(
            context,
            section.title,
            section.lines.flatMap((line) => markdownToPlainLines(line)),
        );
    }

    drawFooter(context.page);
}

function drawPageSummary(context: FlowContext, page: FarmerDocumentationPage) {
    const rows = page.summaryRows;
    const boxHeight = rows.length * 21 + 18;
    context = ensureSpace(context, boxHeight);
    context.page.fillRect({
        x: margin,
        y: context.y - boxHeight,
        width: contentWidth,
        height: boxHeight,
        color: colors.softGray,
    });

    let y = context.y - 25;
    for (const row of rows) {
        context.page.text({
            x: margin + 12,
            y,
            value: row.label.toUpperCase(),
            size: 6.9,
            font: 'F2',
            color: colors.muted,
        });
        context.page.text({
            x: margin + 142,
            y,
            value: row.value,
            size: 9,
            font: 'F2',
            color: colors.text,
        });
        y -= 21;
    }

    context.y -= boxHeight + 16;
    return context;
}

function startPage(pages: PdfCanvas[], header: HeaderData): FlowContext {
    const page = new PdfCanvas();
    pages.push(page);
    page.fillRect({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: colors.white,
    });
    drawHeader(page, header);

    return {
        page,
        pages,
        header,
        y: pageHeight - margin - headerHeight,
    };
}

function ensureSpace(context: FlowContext, height: number): FlowContext {
    if (context.y - height >= bottomY) {
        return context;
    }

    drawFooter(context.page);
    return startPage(context.pages, {
        ...context.header,
        subtitle: `${context.header.subtitle} - nastavak`,
    });
}

function drawSection(
    initialContext: FlowContext,
    title: string,
    rawLines: string[],
) {
    let context = ensureSpace(initialContext, 34);
    context.page.text({
        x: margin,
        y: context.y,
        value: title.toUpperCase(),
        size: 8,
        font: 'F2',
        color: colors.brand,
    });
    context.page.line({
        x1: margin,
        y1: context.y - 7,
        x2: pageWidth - margin,
        y2: context.y - 7,
        color: colors.line,
    });
    context.y -= 24;

    for (const rawLine of rawLines) {
        const line = rawLine.trim();
        if (!line) {
            context.y -= 6;
            continue;
        }

        const wrappedLines = wrapText(line, contentWidth, bodyFontSize);
        for (const wrappedLine of wrappedLines) {
            context = ensureSpace(context, bodyLineHeight);
            context.page.text({
                x: margin,
                y: context.y,
                value: wrappedLine,
                size: bodyFontSize,
                color: colors.text,
            });
            context.y -= bodyLineHeight;
        }
    }

    context.y -= 12;
    return context;
}

function drawHeader(page: PdfCanvas, header: HeaderData) {
    drawLogo(page, margin, pageHeight - margin - 28);
    const headerTextWidth = contentWidth - 86;

    page.text({
        x: margin,
        y: pageHeight - margin - 54,
        value: header.code,
        size: 10,
        font: 'F2',
        color: colors.brand,
    });
    page.text({
        x: margin,
        y: pageHeight - margin - 76,
        value: fitSingleLine(header.title, headerTextWidth, titleFontSize),
        size: titleFontSize,
        font: 'F2',
        color: colors.text,
    });
    page.text({
        x: margin,
        y: pageHeight - margin - 94,
        value: fitSingleLine(header.subtitle, headerTextWidth, 9),
        size: 9,
        color: colors.muted,
    });

    const metaX = pageWidth - margin - 190;
    page.text({
        x: metaX,
        y: pageHeight - margin - 16,
        value: `Verzija ${header.version}`,
        size: smallFontSize,
        font: 'F2',
        color: colors.text,
    });
    page.text({
        x: metaX,
        y: pageHeight - margin - 31,
        value: `Datum ${formatDocumentationDateTime(header.generatedAt)}`,
        size: smallFontSize,
        color: colors.muted,
    });

    drawQrCode(
        page,
        header.qrUrl,
        pageWidth - margin - 60,
        pageHeight - 98,
        58,
    );
    page.line({
        x1: margin,
        y1: pageHeight - margin - headerHeight + 18,
        x2: pageWidth - margin,
        y2: pageHeight - margin - headerHeight + 18,
        color: colors.line,
    });
}

function drawLogo(page: PdfCanvas, x: number, y: number, scale = 1) {
    const markSize = 25 * scale;
    const iconScale = markSize / 30;

    for (const commands of logoMarkPaths) {
        page.path({
            commands,
            color: colors.brand,
            transform: {
                a: iconScale,
                b: 0,
                c: 0,
                d: -iconScale,
                e: x,
                f: y + markSize,
            },
        });
    }

    page.text({
        x: x + 35 * scale,
        y: y + 3.9 * scale,
        value: 'Gredice',
        size: logoWordmarkFontSize * scale,
        strokeWidth: logoWordmarkStrokeWidth * scale,
        color: colors.brand,
    });
}

function drawQrCode(
    page: PdfCanvas,
    payload: string,
    x: number,
    y: number,
    size: number,
) {
    const qrCode = createQrCode(payload, { errorCorrectionLevel: 'M' });
    const moduleCount = qrCode.modules.size;
    const quietModules = 4;
    const cellSize = size / (moduleCount + quietModules * 2);
    const offset = quietModules * cellSize;

    page.fillRect({ x, y, width: size, height: size, color: colors.white });
    for (let row = 0; row < moduleCount; row += 1) {
        for (let column = 0; column < moduleCount; column += 1) {
            if (!qrCode.modules.data[row * moduleCount + column]) {
                continue;
            }
            page.fillRect({
                x: x + offset + column * cellSize,
                y: y + size - offset - (row + 1) * cellSize,
                width: cellSize,
                height: cellSize,
                color: colors.black,
            });
        }
    }
}

function drawFooter(page: PdfCanvas) {
    page.line({
        x1: margin,
        y1: 30,
        x2: pageWidth - margin,
        y2: 30,
        color: colors.line,
    });
    page.text({
        x: margin,
        y: 15,
        value: 'Gredice - farmerska tiskana dokumentacija',
        size: 7.4,
        color: colors.muted,
    });
}

function markdownToPlainLines(value: string) {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
        .split('\n')
        .map((line) =>
            line
                .replace(/^#{1,6}\s+/, '')
                .replace(/^[-*]\s+/, '- ')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .trim(),
        );
}

function wrapText(value: string, maxWidth: number, fontSize: number) {
    const text = sanitizePdfText(value).trim();
    if (!text) {
        return [];
    }

    const lines: string[] = [];
    let currentLine = '';

    for (const word of text.split(/\s+/)) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (measureText(nextLine, fontSize) <= maxWidth) {
            currentLine = nextLine;
            continue;
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        if (measureText(word, fontSize) <= maxWidth) {
            currentLine = word;
            continue;
        }

        const wordParts = splitLongWord(word, maxWidth, fontSize);
        lines.push(...wordParts.slice(0, -1));
        currentLine = wordParts.at(-1) ?? '';
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

function splitLongWord(word: string, maxWidth: number, fontSize: number) {
    const parts: string[] = [];
    let currentPart = '';

    for (const character of word) {
        const nextPart = `${currentPart}${character}`;
        if (measureText(nextPart, fontSize) <= maxWidth) {
            currentPart = nextPart;
            continue;
        }

        if (currentPart) {
            parts.push(currentPart);
        }
        currentPart = character;
    }

    if (currentPart) {
        parts.push(currentPart);
    }

    return parts.length > 0 ? parts : [''];
}

function measureText(value: string, fontSize: number) {
    return value.length * fontSize * 0.52;
}

function fitSingleLine(value: string, maxWidth: number, fontSize: number) {
    const text = sanitizePdfText(value).trim();
    if (measureText(text, fontSize) <= maxWidth) {
        return text;
    }

    let truncated = text;
    while (
        truncated.length > 0 &&
        measureText(`${truncated}...`, fontSize) > maxWidth
    ) {
        truncated = truncated.slice(0, -1).trimEnd();
    }

    return truncated ? `${truncated}...` : '...';
}

function escapePdfText(value: string) {
    return sanitizePdfText(value)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function sanitizePdfText(value: string) {
    return value
        .replace(
            /[\u010c\u010d\u0106\u0107\u0110\u0111\u0160\u0161\u017d\u017e]/g,
            (character) => croatianReplacements[character] ?? character,
        )
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[–—]/g, '-')
        .replace(/→/g, '->')
        .replace(/[^\x20-\x7e]/g, '?');
}

function formatNumber(value: number) {
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatColor(color: PdfColor) {
    return [color.r, color.g, color.b].map(formatNumber).join(' ');
}

function writePdf(pageContentStreams: string[]) {
    const objects: string[] = [];
    const fontId = 3;
    const boldFontId = 4;
    const firstPageObjectId = 5;
    const kids = pageContentStreams
        .map((_, index) => `${firstPageObjectId + index * 2} 0 R`)
        .join(' ');

    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(
        `<< /Type /Pages /Kids [${kids}] /Count ${pageContentStreams.length} >>`,
    );
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    pageContentStreams.forEach((content, index) => {
        const pageObjectId = firstPageObjectId + index * 2;
        const contentObjectId = pageObjectId + 1;
        objects.push(
            [
                '<< /Type /Page',
                '/Parent 2 0 R',
                `/MediaBox [0 0 ${formatNumber(pageWidth)} ${formatNumber(pageHeight)}]`,
                `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >>`,
                `/Contents ${contentObjectId} 0 R`,
                '>>',
            ].join(' '),
        );
        objects.push(
            `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        );
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
        pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

    const bytes = new TextEncoder().encode(pdf);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);

    return buffer;
}
