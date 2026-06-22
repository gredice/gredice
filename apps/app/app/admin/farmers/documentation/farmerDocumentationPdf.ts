import { deflateSync } from 'node:zlib';
import { create as createQrCode } from 'qrcode';
import sharp from 'sharp';
import {
    currentDocumentationPages,
    discardedDocumentationPages,
    documentationChangeLabel,
    type FarmerDocumentationAttribute,
    type FarmerDocumentationImage,
    type FarmerDocumentationPackage,
    type FarmerDocumentationPackageContent,
    type FarmerDocumentationPage,
    type FarmerDocumentationSection,
    formatDocumentationDateTime,
    getFarmerAppOrigin,
    includedDocumentationPages,
} from './farmerDocumentationData';

type PdfFontKey = 'F1' | 'F2' | 'F3' | 'F4';

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

type MarkdownInlineStyle = {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
};

type MarkdownTextRun = {
    value: string;
    font?: PdfFontKey;
    color?: PdfColor;
};

type MarkdownBlock =
    | {
          type: 'paragraph';
          runs: MarkdownTextRun[];
      }
    | {
          type: 'heading';
          level: number;
          runs: MarkdownTextRun[];
      }
    | {
          type: 'list';
          items: MarkdownListItem[];
      }
    | {
          type: 'table';
          headers: MarkdownTextRun[][];
          rows: MarkdownTextRun[][][];
      }
    | {
          type: 'blockquote';
          blocks: MarkdownBlock[];
      }
    | {
          type: 'rule';
      };

type MarkdownListItem = {
    level: number;
    marker: string;
    runs: MarkdownTextRun[];
};

type MarkdownRenderOptions = {
    x: number;
    width: number;
    color?: PdfColor;
};

type FlowContext = {
    page: PdfCanvas;
    pages: PdfCanvas[];
    header: HeaderData;
    y: number;
};

type PdfImageAsset = {
    name: string;
    url: string;
    width: number;
    height: number;
    dataHex: string;
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
const summaryLabelFontSize = 6.7;
const summaryValueFontSize = 8.7;
const summaryRowHeight = 16;
const markdownBlockSpacing = 5;
const markdownListIndent = 13;
const markdownListMarkerWidth = 15;
const compactAttributeColumnGap = 18;
const logoWordmarkFontSize = 18.75;
const logoWordmarkStrokeWidth = 0.16;
const imageGalleryColumns = 4;
const imageGalleryGap = 10;
const imageGalleryLabelHeight = 20;
const imageGalleryCardWidth =
    (contentWidth - imageGalleryGap * (imageGalleryColumns - 1)) /
    imageGalleryColumns;
const imageGalleryImageHeight = 76;
const imageGalleryCardHeight =
    imageGalleryImageHeight + imageGalleryLabelHeight + 12;
const maxPdfImageSourceBytes = 10 * 1024 * 1024;

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

const latinExtendedGlyphs = [
    { character: 'Č', code: 0x80, glyph: 'Ccaron', unicode: '010C' },
    { character: 'č', code: 0x81, glyph: 'ccaron', unicode: '010D' },
    { character: 'Ć', code: 0x82, glyph: 'Cacute', unicode: '0106' },
    { character: 'ć', code: 0x83, glyph: 'cacute', unicode: '0107' },
    { character: 'Đ', code: 0x84, glyph: 'Dcroat', unicode: '0110' },
    { character: 'đ', code: 0x85, glyph: 'dcroat', unicode: '0111' },
    { character: 'Š', code: 0x86, glyph: 'Scaron', unicode: '0160' },
    { character: 'š', code: 0x87, glyph: 'scaron', unicode: '0161' },
    { character: 'Ž', code: 0x88, glyph: 'Zcaron', unicode: '017D' },
    { character: 'ž', code: 0x89, glyph: 'zcaron', unicode: '017E' },
] as const;

const latinExtendedGlyphByCharacter: ReadonlyMap<
    string,
    (typeof latinExtendedGlyphs)[number]
> = new Map(latinExtendedGlyphs.map((glyph) => [glyph.character, glyph]));

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

    image({
        height,
        name,
        width,
        x,
        y,
    }: {
        height: number;
        name: string;
        width: number;
        x: number;
        y: number;
    }) {
        this.operations.push(
            [
                'q',
                `${formatNumber(width)} 0 0 ${formatNumber(
                    height,
                )} ${formatNumber(x)} ${formatNumber(y)} cm`,
                `/${name} Do`,
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

export async function generateFarmerDocumentationPdf(
    data: FarmerDocumentationPackage,
    {
        content = 'all',
    }: {
        content?: FarmerDocumentationPackageContent;
    } = {},
): Promise<ArrayBuffer> {
    const farmOrigin = getFarmerAppOrigin();
    const version = farmerDocumentationVersion(data.generatedAt);
    const documentationPages = includedDocumentationPages(data, content);
    const imageAssets = await loadDocumentationImageAssets(documentationPages);
    const imageAssetsByUrl = new Map(
        imageAssets.map((asset) => [asset.url, asset]),
    );
    const pages: PdfCanvas[] = [];

    const guideStartIndex = pages.length;
    drawOrganizationGuide({ content, data, farmOrigin, pages, version });
    if (documentationPages.length > 0) {
        appendDuplexBlankPageIfNeeded(pages, guideStartIndex);
    }

    for (let index = 0; index < documentationPages.length; index += 1) {
        const page = documentationPages[index];
        if (!page) {
            continue;
        }

        const pageStartIndex = pages.length;
        drawDocumentationPage({
            data,
            farmOrigin,
            imageAssetsByUrl,
            pages,
            version,
            page,
        });
        if (index < documentationPages.length - 1) {
            appendDuplexBlankPageIfNeeded(pages, pageStartIndex);
        }
    }

    return writePdf(
        pages.map((page) => page.toString()),
        imageAssets,
    );
}

function appendDuplexBlankPageIfNeeded(
    pages: PdfCanvas[],
    documentStartIndex: number,
) {
    if ((pages.length - documentStartIndex) % 2 === 0) {
        return;
    }

    const page = new PdfCanvas();
    page.fillRect({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: colors.white,
    });
    pages.push(page);
}

async function loadDocumentationImageAssets(pages: FarmerDocumentationPage[]) {
    const uniqueImages = uniquePageImages(pages);
    const assetsByIndex: Array<PdfImageAsset | null> = new Array(
        uniqueImages.length,
    ).fill(null);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < uniqueImages.length) {
            const imageIndex = nextIndex;
            nextIndex += 1;
            const image = uniqueImages[imageIndex];
            if (!image) {
                continue;
            }

            assetsByIndex[imageIndex] = await loadDocumentationImageAsset({
                image,
                name: `Im${imageIndex + 1}`,
            });
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(6, uniqueImages.length) }, () =>
            worker(),
        ),
    );

    return assetsByIndex.filter(
        (asset): asset is PdfImageAsset => asset !== null,
    );
}

function uniquePageImages(pages: FarmerDocumentationPage[]) {
    const images: FarmerDocumentationImage[] = [];
    const seenUrls = new Set<string>();

    for (const page of pages) {
        for (const image of page.images) {
            if (seenUrls.has(image.url)) {
                continue;
            }

            images.push(image);
            seenUrls.add(image.url);
        }
    }

    return images;
}

async function loadDocumentationImageAsset({
    image,
    name,
}: {
    image: FarmerDocumentationImage;
    name: string;
}) {
    try {
        const bytes = await documentationImageBytes(image.url);
        if (!bytes || bytes.byteLength > maxPdfImageSourceBytes) {
            return null;
        }

        const { data, info } = await sharp(bytes, {
            animated: false,
            limitInputPixels: 36_000_000,
        })
            .rotate()
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize({
                width: 900,
                height: 700,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ quality: 82, mozjpeg: true })
            .toBuffer({ resolveWithObject: true });

        if (!info.width || !info.height) {
            return null;
        }

        return {
            name,
            url: image.url,
            width: info.width,
            height: info.height,
            dataHex: data.toString('hex').toUpperCase(),
        };
    } catch {
        return null;
    }
}

async function documentationImageBytes(url: string) {
    const dataUrlBytes = documentationImageDataUrlBytes(url);
    if (dataUrlBytes) {
        return dataUrlBytes;
    }

    if (!/^https?:\/\//u.test(url)) {
        return null;
    }

    const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
        return null;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.toLowerCase().startsWith('image/')) {
        return null;
    }

    return new Uint8Array(await response.arrayBuffer());
}

function documentationImageDataUrlBytes(url: string) {
    const match = /^data:image\/[-+.\w]+;base64,([A-Za-z0-9+/=]+)$/u.exec(
        url.trim(),
    );
    if (!match?.[1]) {
        return null;
    }

    return new Uint8Array(Buffer.from(match[1], 'base64'));
}

export function farmerDocumentationFilename(
    data: FarmerDocumentationPackage,
    content: FarmerDocumentationPackageContent = 'all',
) {
    const datePart = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(data.generatedAt);
    const scopePart = data.since ? 'promjene' : 'sve-stranice';
    const contentPart = farmerDocumentationFilenameContentPart(content);

    return `farmeri-dokumentacija-${scopePart}${contentPart}-${datePart}.pdf`;
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
    content,
    data,
    farmOrigin,
    pages,
    version,
}: {
    content: FarmerDocumentationPackageContent;
    data: FarmerDocumentationPackage;
    farmOrigin: string;
    pages: PdfCanvas[];
    version: string;
}) {
    const subtitleScope = data.since
        ? `Promjene od ${formatDocumentationDateTime(data.since)}`
        : 'Cijeli priručnik';
    const subtitleContent = organizationGuideContentSubtitle(content);
    let context = startPage(pages, {
        code: 'ORG-GUIDE',
        title: 'Vodič za organizaciju',
        subtitle: subtitleContent
            ? `${subtitleScope} - ${subtitleContent}`
            : subtitleScope,
        qrUrl: farmOrigin,
        version,
        generatedAt: data.generatedAt,
    });
    const packageType = organizationGuidePackageDescription(data, content);
    const includedPages = includedDocumentationPages(data, content);
    const allCurrentPages = currentDocumentationPages(data);
    const discardedPages = discardedDocumentationPages(data, content);

    context = drawSection(context, 'Svrha paketa', [
        packageType,
        'Stranice nisu numerirane. U registratoru ih drži abecedno prema naslovu stranice, odnosno velikom naslovu u zaglavlju.',
        'Ako dvije stranice imaju isti naslov, zadrži redoslijed prema kodu.',
        'Kod dodavanja ili zamjene stranica novu verziju umetni na mjesto navedeno u uputama ispod.',
    ]);

    context = drawActionList(
        context,
        'Umetni nove stranice',
        includedPages.filter((page) => page.changeType === 'insert'),
        allCurrentPages,
    );
    context = drawActionList(
        context,
        'Zamijeni postojeće stranice',
        includedPages.filter((page) => page.changeType === 'replace'),
        allCurrentPages,
    );
    context = drawDiscardList(context, discardedPages);
    context = drawSection(context, 'Kontrola nakon umetanja', [
        '1. Provjeri da je svaka nova ili zamijenjena stranica umetnuta na navedeno abecedno mjesto i da kod odgovara kodu u ovom vodiču.',
        '2. Stare stranice iz odjeljka za zamjenu izdvoji i odbaci nakon što nova verzija stoji u registratoru.',
        '3. Stranice iz odjeljka za uklanjanje izvadi iz registratora bez zamjenske stranice.',
        '4. QR kod na svakoj stranici vodi na farmer aplikaciju za aktualnu digitalnu verziju priručnika.',
    ]);

    drawFooter(context.page);
}

function farmerDocumentationFilenameContentPart(
    content: FarmerDocumentationPackageContent,
) {
    switch (content) {
        case 'all':
            return '';
        case 'operations':
            return '-radnje';
        case 'plants':
            return '-biljke-sorte';
    }
}

function organizationGuideContentSubtitle(
    content: FarmerDocumentationPackageContent,
) {
    switch (content) {
        case 'all':
            return null;
        case 'operations':
            return 'Radnje';
        case 'plants':
            return 'Biljke i sorte';
    }
}

function organizationGuidePackageDescription(
    data: FarmerDocumentationPackage,
    content: FarmerDocumentationPackageContent,
) {
    const contentLabel = organizationGuidePackageContentLabel(content);

    if (data.since) {
        return `Paket sadrži organizacijski vodič i ${contentLabel} promijenjene od zadnjeg ispisa.`;
    }

    return `Paket sadrži organizacijski vodič i ${contentLabel} trenutno objavljene u farmer aplikaciji.`;
}

function organizationGuidePackageContentLabel(
    content: FarmerDocumentationPackageContent,
) {
    switch (content) {
        case 'all':
            return 'sve priručnike';
        case 'operations':
            return 'priručnike radnji';
        case 'plants':
            return 'priručnike biljaka i sorti';
    }
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
        return `abecedno između ${pageReference(previousPage)} i ${pageReference(nextPage)}`;
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
    imageAssetsByUrl,
    page,
    pages,
    version,
}: {
    data: FarmerDocumentationPackage;
    farmOrigin: string;
    imageAssetsByUrl: ReadonlyMap<string, PdfImageAsset>;
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
    context = drawImageGallery(context, page, imageAssetsByUrl);

    for (let index = 0; index < page.sections.length; index += 1) {
        const section = page.sections[index];
        if (!section) {
            continue;
        }

        if (section.layout === 'compactAttributes') {
            const sections: FarmerDocumentationSection[] = [];
            let cursor = index;

            while (
                cursor < page.sections.length &&
                page.sections[cursor]?.layout === 'compactAttributes'
            ) {
                const compactSection = page.sections[cursor];
                if (compactSection) {
                    sections.push(compactSection);
                }
                cursor += 1;
            }

            context = drawCompactAttributeSections(context, sections);
            index = cursor - 1;
            continue;
        }

        context = drawMarkdownSection(context, section.title, section.lines);
    }

    drawFooter(context.page);
}

function drawPageSummary(context: FlowContext, page: FarmerDocumentationPage) {
    const rows = page.summaryRows;
    const boxHeight = rows.length * summaryRowHeight + 16;
    context = ensureSpace(context, boxHeight);
    context.page.fillRect({
        x: margin,
        y: context.y - boxHeight,
        width: contentWidth,
        height: boxHeight,
        color: colors.softGray,
    });

    let y = context.y - 22;
    for (const row of rows) {
        context.page.text({
            x: margin + 12,
            y,
            value: row.label.toUpperCase(),
            size: summaryLabelFontSize,
            font: 'F2',
            color: colors.muted,
        });
        context.page.text({
            x: margin + 142,
            y,
            value: fitSingleLine(
                row.value,
                contentWidth - 154,
                summaryValueFontSize,
            ),
            size: summaryValueFontSize,
            font: 'F2',
            color: colors.text,
        });
        y -= summaryRowHeight;
    }

    context.y -= boxHeight + 12;
    return context;
}

function drawImageGallery(
    initialContext: FlowContext,
    page: FarmerDocumentationPage,
    imageAssetsByUrl: ReadonlyMap<string, PdfImageAsset>,
) {
    const images = page.images
        .map((image) => ({
            image,
            asset: imageAssetsByUrl.get(image.url) ?? null,
        }))
        .filter(
            (
                entry,
            ): entry is {
                image: FarmerDocumentationImage;
                asset: PdfImageAsset;
            } => entry.asset !== null,
        );

    if (images.length === 0) {
        return initialContext;
    }

    let context = ensureSpace(initialContext, 34);
    context.page.text({
        x: margin,
        y: context.y,
        value: 'SLIKE',
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

    for (let index = 0; index < images.length; index += imageGalleryColumns) {
        context = ensureSpace(context, imageGalleryCardHeight);
        const rowImages = images.slice(index, index + imageGalleryColumns);

        rowImages.forEach(({ asset, image }, columnIndex) => {
            const x =
                margin +
                columnIndex * (imageGalleryCardWidth + imageGalleryGap);
            drawImageCard(context.page, {
                asset,
                image,
                x,
                y: context.y,
            });
        });

        context.y -= imageGalleryCardHeight;
    }

    context.y -= 4;
    return context;
}

function drawImageCard(
    page: PdfCanvas,
    {
        asset,
        image,
        x,
        y,
    }: {
        asset: PdfImageAsset;
        image: FarmerDocumentationImage;
        x: number;
        y: number;
    },
) {
    const imageBoxY = y - imageGalleryImageHeight;
    const fitted = fitImageInsideBox(
        asset,
        imageGalleryCardWidth,
        imageGalleryImageHeight,
    );

    page.fillRect({
        x,
        y: imageBoxY,
        width: imageGalleryCardWidth,
        height: imageGalleryImageHeight,
        color: colors.softGray,
    });
    page.image({
        name: asset.name,
        x: x + (imageGalleryCardWidth - fitted.width) / 2,
        y: imageBoxY + (imageGalleryImageHeight - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height,
    });
    page.text({
        x,
        y: imageBoxY - 14,
        value: fitSingleLine(image.label, imageGalleryCardWidth, smallFontSize),
        size: smallFontSize,
        color: colors.muted,
    });
}

function fitImageInsideBox(
    image: Pick<PdfImageAsset, 'width' | 'height'>,
    maxWidth: number,
    maxHeight: number,
) {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

    return {
        width: image.width * scale,
        height: image.height * scale,
    };
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
    let context = drawSectionHeader(
        initialContext,
        title,
        margin,
        contentWidth,
    );

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

function drawSectionHeader(
    initialContext: FlowContext,
    title: string,
    x: number,
    width: number,
) {
    const context = ensureSpace(initialContext, 34);
    context.page.text({
        x,
        y: context.y,
        value: title.toUpperCase(),
        size: 8,
        font: 'F2',
        color: colors.brand,
    });
    context.page.line({
        x1: x,
        y1: context.y - 7,
        x2: x + width,
        y2: context.y - 7,
        color: colors.line,
    });
    context.y -= 24;

    return context;
}

function drawMarkdownSection(
    initialContext: FlowContext,
    title: string,
    rawLines: string[],
) {
    let context = drawSectionHeader(
        initialContext,
        title,
        margin,
        contentWidth,
    );
    context = drawMarkdownBlocks(
        context,
        parseMarkdownBlocks(rawLines.join('\n\n')),
        {
            x: margin,
            width: contentWidth,
        },
    );
    context.y -= 12;

    return context;
}

function drawCompactAttributeSections(
    initialContext: FlowContext,
    sections: FarmerDocumentationSection[],
) {
    let context = initialContext;
    const columnWidth = (contentWidth - compactAttributeColumnGap) / 2;

    for (let index = 0; index < sections.length; index += 2) {
        const firstSection = sections[index];
        const secondSection = sections[index + 1];
        if (!firstSection) {
            continue;
        }

        const rowSections = secondSection
            ? [firstSection, secondSection]
            : [firstSection];
        const rowHeight = Math.max(
            ...rowSections.map((section) =>
                compactAttributeSectionHeight(section, columnWidth),
            ),
        );

        context = ensureSpace(context, rowHeight);
        drawCompactAttributeSection(
            context.page,
            firstSection,
            margin,
            context.y,
            columnWidth,
        );

        if (secondSection) {
            drawCompactAttributeSection(
                context.page,
                secondSection,
                margin + columnWidth + compactAttributeColumnGap,
                context.y,
                columnWidth,
            );
        }

        context.y -= rowHeight;
    }

    context.y -= 8;
    return context;
}

function drawCompactAttributeSection(
    page: PdfCanvas,
    section: FarmerDocumentationSection,
    x: number,
    y: number,
    width: number,
) {
    page.text({
        x,
        y,
        value: section.title.toUpperCase(),
        size: 8,
        font: 'F2',
        color: colors.brand,
    });
    page.line({
        x1: x,
        y1: y - 7,
        x2: x + width,
        y2: y - 7,
        color: colors.line,
    });

    let cursorY = y - 24;
    for (const row of compactAttributeRows(section)) {
        const runs: MarkdownTextRun[] = [
            { value: `${row.label}: `, font: 'F2' },
            { value: row.value },
        ];
        const wrappedLines = wrapInlineRuns(runs, width, bodyFontSize);
        for (const wrappedLine of wrappedLines) {
            drawInlineRunLine(
                page,
                x,
                cursorY,
                wrappedLine,
                bodyFontSize,
                colors.text,
            );
            cursorY -= bodyLineHeight;
        }
    }
}

function compactAttributeSectionHeight(
    section: FarmerDocumentationSection,
    width: number,
) {
    const rowHeight = compactAttributeRows(section).reduce((total, row) => {
        const runs: MarkdownTextRun[] = [
            { value: `${row.label}: `, font: 'F2' },
            { value: row.value },
        ];
        return (
            total +
            Math.max(1, wrapInlineRuns(runs, width, bodyFontSize).length) *
                bodyLineHeight
        );
    }, 0);

    return 24 + rowHeight + 14;
}

function compactAttributeRows(section: FarmerDocumentationSection) {
    if (section.attributes) {
        return section.attributes;
    }

    return section.lines
        .map((line): FarmerDocumentationAttribute | null => {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex < 0) {
                return { label: line, value: '' };
            }

            const label = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 1).trim();
            return label && value ? { label, value } : null;
        })
        .filter((row): row is FarmerDocumentationAttribute => row !== null);
}

function drawMarkdownBlocks(
    initialContext: FlowContext,
    blocks: MarkdownBlock[],
    options: MarkdownRenderOptions,
) {
    let context = initialContext;

    for (const block of blocks) {
        switch (block.type) {
            case 'paragraph':
                context = drawMarkdownParagraph(context, block.runs, options);
                break;
            case 'heading':
                context = drawMarkdownHeading(
                    context,
                    block.level,
                    block.runs,
                    options,
                );
                break;
            case 'list':
                context = drawMarkdownList(context, block.items, options);
                break;
            case 'table':
                context = drawMarkdownTable(context, block, options);
                break;
            case 'blockquote':
                context = drawMarkdownBlockquote(
                    context,
                    block.blocks,
                    options,
                );
                break;
            case 'rule':
                context = drawMarkdownRule(context, options);
                break;
        }
    }

    return context;
}

function drawMarkdownParagraph(
    initialContext: FlowContext,
    runs: MarkdownTextRun[],
    options: MarkdownRenderOptions,
) {
    const context = drawWrappedInlineRuns(
        initialContext,
        runs,
        options.x,
        options.width,
        bodyFontSize,
        bodyLineHeight,
        options.color ?? colors.text,
    );
    context.y -= markdownBlockSpacing;

    return context;
}

function drawMarkdownHeading(
    initialContext: FlowContext,
    level: number,
    runs: MarkdownTextRun[],
    options: MarkdownRenderOptions,
) {
    const fontSize = level <= 1 ? 12 : level === 2 ? 10.8 : 9.8;
    const lineHeight = fontSize + 4;
    const headingRuns = runs.map((run) => ({
        ...run,
        font: boldFont(run.font),
        color: run.color ?? options.color,
    }));
    const context = drawWrappedInlineRuns(
        initialContext,
        headingRuns,
        options.x,
        options.width,
        fontSize,
        lineHeight,
        options.color ?? colors.text,
    );
    context.y -= markdownBlockSpacing;

    return context;
}

function drawMarkdownList(
    initialContext: FlowContext,
    items: MarkdownListItem[],
    options: MarkdownRenderOptions,
) {
    let context = initialContext;

    for (const item of items) {
        const levelIndent = Math.min(item.level, 6) * markdownListIndent;
        const markerX = options.x + levelIndent;
        const textX = markerX + markdownListMarkerWidth;
        const textWidth = options.width - levelIndent - markdownListMarkerWidth;
        const wrappedLines = wrapInlineRuns(
            item.runs,
            Math.max(36, textWidth),
            bodyFontSize,
        );

        for (let index = 0; index < wrappedLines.length; index += 1) {
            const line = wrappedLines[index];
            if (!line) {
                continue;
            }

            context = ensureSpace(context, bodyLineHeight);
            if (index === 0) {
                context.page.text({
                    x: markerX,
                    y: context.y,
                    value: item.marker,
                    size: bodyFontSize,
                    color: options.color ?? colors.text,
                });
            }

            drawInlineRunLine(
                context.page,
                textX,
                context.y,
                line,
                bodyFontSize,
                options.color ?? colors.text,
            );
            context.y -= bodyLineHeight;
        }
    }

    context.y -= markdownBlockSpacing;
    return context;
}

function drawMarkdownTable(
    initialContext: FlowContext,
    table: Extract<MarkdownBlock, { type: 'table' }>,
    options: MarkdownRenderOptions,
) {
    const columnCount = Math.max(
        table.headers.length,
        ...table.rows.map((row) => row.length),
        1,
    );
    const columnWidth = options.width / columnCount;
    let context = initialContext;
    const rows = [table.headers, ...table.rows];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        if (!row) {
            continue;
        }

        const headerRow = rowIndex === 0;
        const rowRuns = Array.from({ length: columnCount }, (_, index) => {
            const cellRuns = row[index] ?? [];
            return headerRow
                ? cellRuns.map((run) => ({
                      ...run,
                      font: boldFont(run.font),
                  }))
                : cellRuns;
        });
        const wrappedCells = rowRuns.map((cellRuns) =>
            wrapInlineRuns(cellRuns, columnWidth - 10, bodyFontSize),
        );
        const rowHeight =
            Math.max(
                1,
                ...wrappedCells.map((cell) => Math.max(1, cell.length)),
            ) *
                bodyLineHeight +
            10;

        context = ensureSpace(context, rowHeight);
        const rowTopY = context.y + 4;
        const rowBottomY = rowTopY - rowHeight;

        if (headerRow) {
            context.page.fillRect({
                x: options.x,
                y: rowBottomY,
                width: options.width,
                height: rowHeight,
                color: colors.softGray,
            });
        }

        context.page.line({
            x1: options.x,
            y1: rowTopY,
            x2: options.x + options.width,
            y2: rowTopY,
            color: colors.line,
        });
        context.page.line({
            x1: options.x,
            y1: rowBottomY,
            x2: options.x + options.width,
            y2: rowBottomY,
            color: colors.line,
        });

        for (
            let columnIndex = 0;
            columnIndex <= columnCount;
            columnIndex += 1
        ) {
            const x = options.x + columnIndex * columnWidth;
            context.page.line({
                x1: x,
                y1: rowTopY,
                x2: x,
                y2: rowBottomY,
                color: colors.line,
                width: 0.4,
            });
        }

        for (
            let columnIndex = 0;
            columnIndex < wrappedCells.length;
            columnIndex += 1
        ) {
            const cellLines = wrappedCells[columnIndex] ?? [];
            const cellX = options.x + columnIndex * columnWidth + 5;
            for (
                let lineIndex = 0;
                lineIndex < cellLines.length;
                lineIndex += 1
            ) {
                const line = cellLines[lineIndex];
                if (!line) {
                    continue;
                }

                drawInlineRunLine(
                    context.page,
                    cellX,
                    context.y - lineIndex * bodyLineHeight,
                    line,
                    bodyFontSize,
                    options.color ?? colors.text,
                );
            }
        }

        context.y -= rowHeight;
    }

    context.y -= markdownBlockSpacing + 2;
    return context;
}

function drawMarkdownBlockquote(
    initialContext: FlowContext,
    blocks: MarkdownBlock[],
    options: MarkdownRenderOptions,
) {
    let context = ensureSpace(initialContext, bodyLineHeight);
    const topY = context.y + 4;
    const lineX = options.x + 2;

    context = drawMarkdownBlocks(context, blocks, {
        x: options.x + 12,
        width: options.width - 12,
        color: colors.muted,
    });
    context.page.line({
        x1: lineX,
        y1: topY,
        x2: lineX,
        y2: context.y + 4,
        color: colors.line,
        width: 1.2,
    });
    context.y -= markdownBlockSpacing;

    return context;
}

function drawMarkdownRule(
    initialContext: FlowContext,
    options: MarkdownRenderOptions,
) {
    const context = ensureSpace(initialContext, bodyLineHeight);
    context.page.line({
        x1: options.x,
        y1: context.y - 2,
        x2: options.x + options.width,
        y2: context.y - 2,
        color: colors.line,
    });
    context.y -= bodyLineHeight;

    return context;
}

function drawWrappedInlineRuns(
    initialContext: FlowContext,
    runs: MarkdownTextRun[],
    x: number,
    width: number,
    fontSize: number,
    lineHeight: number,
    color: PdfColor,
) {
    let context = initialContext;
    const lines = wrapInlineRuns(runs, width, fontSize);

    for (const line of lines) {
        context = ensureSpace(context, lineHeight);
        drawInlineRunLine(context.page, x, context.y, line, fontSize, color);
        context.y -= lineHeight;
    }

    return context;
}

function drawInlineRunLine(
    page: PdfCanvas,
    x: number,
    y: number,
    runs: MarkdownTextRun[],
    fontSize: number,
    color: PdfColor,
) {
    let cursorX = x;

    for (const run of runs) {
        if (!run.value) {
            continue;
        }

        page.text({
            x: cursorX,
            y,
            value: run.value,
            size: fontSize,
            font: run.font ?? 'F1',
            color: run.color ?? color,
        });
        cursorX += measureText(run.value, fontSize);
    }
}

function boldFont(font: PdfFontKey | undefined): PdfFontKey {
    return font === 'F3' || font === 'F4' ? 'F4' : 'F2';
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

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
    const lines = value.replace(/\r\n/g, '\n').split('\n');
    const blocks: MarkdownBlock[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index] ?? '';
        const trimmed = line.trim();

        if (!trimmed) {
            index += 1;
            continue;
        }

        const table = parseMarkdownTableAt(lines, index);
        if (table) {
            blocks.push(table.block);
            index = table.nextIndex;
            continue;
        }

        const heading = /^(#{1,6})\s+(.+)$/u.exec(trimmed);
        if (heading?.[1] && heading[2]) {
            blocks.push({
                type: 'heading',
                level: heading[1].length,
                runs: parseInlineMarkdown(heading[2]),
            });
            index += 1;
            continue;
        }

        if (/^(?:-{3,}|\*{3,}|_{3,})$/u.test(trimmed)) {
            blocks.push({ type: 'rule' });
            index += 1;
            continue;
        }

        if (trimmed.startsWith('>')) {
            const quoteLines: string[] = [];
            while (index < lines.length) {
                const quoteLine = lines[index] ?? '';
                const quoteTrimmed = quoteLine.trimStart();
                if (!quoteTrimmed.startsWith('>')) {
                    break;
                }
                quoteLines.push(quoteTrimmed.replace(/^>\s?/u, ''));
                index += 1;
            }
            blocks.push({
                type: 'blockquote',
                blocks: parseMarkdownBlocks(quoteLines.join('\n')),
            });
            continue;
        }

        if (markdownListMatch(line)) {
            const list = parseMarkdownList(lines, index);
            blocks.push(list.block);
            index = list.nextIndex;
            continue;
        }

        const paragraphLines: string[] = [];
        while (index < lines.length) {
            const paragraphLine = lines[index] ?? '';
            if (!paragraphLine.trim()) {
                break;
            }
            if (
                paragraphLines.length > 0 &&
                isMarkdownBlockStart(lines, index)
            ) {
                break;
            }
            paragraphLines.push(paragraphLine.trim());
            index += 1;
        }

        if (paragraphLines.length > 0) {
            blocks.push({
                type: 'paragraph',
                runs: parseInlineMarkdown(paragraphLines.join(' ')),
            });
        }
    }

    return blocks;
}

function isMarkdownBlockStart(lines: string[], index: number) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    return (
        Boolean(parseMarkdownTableAt(lines, index)) ||
        /^(#{1,6})\s+.+$/u.test(trimmed) ||
        /^(?:-{3,}|\*{3,}|_{3,})$/u.test(trimmed) ||
        trimmed.startsWith('>') ||
        Boolean(markdownListMatch(line))
    );
}

function parseMarkdownList(
    lines: string[],
    startIndex: number,
): {
    block: Extract<MarkdownBlock, { type: 'list' }>;
    nextIndex: number;
} {
    const items: MarkdownListItem[] = [];
    let index = startIndex;

    while (index < lines.length) {
        const line = lines[index] ?? '';
        const match = markdownListMatch(line);

        if (match) {
            items.push({
                level: match.level,
                marker: match.marker,
                runs: parseInlineMarkdown(match.content),
            });
            index += 1;
            continue;
        }

        if (!line.trim()) {
            const nextLine = lines[index + 1] ?? '';
            if (markdownListMatch(nextLine)) {
                index += 1;
                continue;
            }
            break;
        }

        const lastItem = items[items.length - 1];
        if (lastItem && /^\s{2,}\S/u.test(line)) {
            appendMarkdownRun(lastItem.runs, { value: ' ' });
            for (const run of parseInlineMarkdown(line.trim())) {
                appendMarkdownRun(lastItem.runs, run);
            }
            index += 1;
            continue;
        }

        break;
    }

    return {
        block: {
            type: 'list',
            items,
        },
        nextIndex: index,
    };
}

function markdownListMatch(line: string) {
    const normalized = line.replace(/\t/g, '    ');
    const match = /^(\s*)(?:(\d+)[.)]|([-+*]))\s+(.*)$/u.exec(normalized);
    if (!match) {
        return null;
    }

    const indent = match[1]?.length ?? 0;
    const numberMarker = match[2];
    const content = match[4] ?? '';

    return {
        level: Math.floor(indent / 2),
        marker: numberMarker ? `${numberMarker}.` : '-',
        content,
    };
}

function parseMarkdownTableAt(
    lines: string[],
    startIndex: number,
): {
    block: Extract<MarkdownBlock, { type: 'table' }>;
    nextIndex: number;
} | null {
    const headerLine = lines[startIndex];
    const separatorLine = lines[startIndex + 1];
    if (!headerLine || !separatorLine || !headerLine.includes('|')) {
        return null;
    }

    const separatorCells = parseMarkdownTableCells(separatorLine);
    if (
        separatorCells.length === 0 ||
        !separatorCells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()))
    ) {
        return null;
    }

    const headers = parseMarkdownTableCells(headerLine).map((cell) =>
        parseInlineMarkdown(cell),
    );
    const rows: MarkdownTextRun[][][] = [];
    let index = startIndex + 2;

    while (index < lines.length) {
        const rowLine = lines[index] ?? '';
        if (!rowLine.trim() || !rowLine.includes('|')) {
            break;
        }
        rows.push(
            parseMarkdownTableCells(rowLine).map((cell) =>
                parseInlineMarkdown(cell),
            ),
        );
        index += 1;
    }

    return {
        block: {
            type: 'table',
            headers,
            rows,
        },
        nextIndex: index,
    };
}

function parseMarkdownTableCells(line: string) {
    const trimmed = line.trim();
    const withoutOuterPipes = trimmed.replace(/^\|/u, '').replace(/\|$/u, '');

    return withoutOuterPipes
        .split(/(?<!\\)\|/u)
        .map((cell) => cell.replace(/\\\|/g, '|').trim());
}

function parseInlineMarkdown(
    value: string,
    style: MarkdownInlineStyle = {},
): MarkdownTextRun[] {
    const runs: MarkdownTextRun[] = [];
    let index = 0;
    let plainText = '';

    function flushPlainText() {
        if (!plainText) {
            return;
        }

        appendMarkdownRun(runs, {
            value: decodeMarkdownEntities(plainText),
            font: markdownInlineFont(style),
            color: style.code ? colors.muted : undefined,
        });
        plainText = '';
    }

    while (index < value.length) {
        const character = value[index];

        if (character === '\\' && index + 1 < value.length) {
            plainText += value[index + 1] ?? '';
            index += 2;
            continue;
        }

        if (value.startsWith('![', index)) {
            const image = parseMarkdownLink(value, index + 1);
            if (image) {
                flushPlainText();
                const imageLabel = inlineText(image.label) || 'Slika';
                appendMarkdownRun(runs, {
                    value: imageLabel,
                    font: markdownInlineFont(style),
                });
                if (image.href) {
                    appendMarkdownRun(runs, {
                        value: ` (${image.href})`,
                        color: colors.muted,
                    });
                }
                index = image.nextIndex;
                continue;
            }
        }

        if (character === '[') {
            const link = parseMarkdownLink(value, index);
            if (link) {
                flushPlainText();
                for (const run of parseInlineMarkdown(link.label, style)) {
                    appendMarkdownRun(runs, run);
                }
                if (link.href) {
                    appendMarkdownRun(runs, {
                        value: ` (${link.href})`,
                        color: colors.muted,
                    });
                }
                index = link.nextIndex;
                continue;
            }
        }

        if (value.startsWith('**', index)) {
            const closeIndex = findClosingMarkdownMarker(
                value,
                '**',
                index + 2,
            );
            if (closeIndex >= 0) {
                flushPlainText();
                for (const run of parseInlineMarkdown(
                    value.slice(index + 2, closeIndex),
                    { ...style, bold: true },
                )) {
                    appendMarkdownRun(runs, run);
                }
                index = closeIndex + 2;
                continue;
            }
        }

        if (value.startsWith('__', index)) {
            const closeIndex = findClosingMarkdownMarker(
                value,
                '__',
                index + 2,
            );
            if (closeIndex >= 0) {
                flushPlainText();
                for (const run of parseInlineMarkdown(
                    value.slice(index + 2, closeIndex),
                    { ...style, bold: true },
                )) {
                    appendMarkdownRun(runs, run);
                }
                index = closeIndex + 2;
                continue;
            }
        }

        if (value.startsWith('~~', index)) {
            const closeIndex = findClosingMarkdownMarker(
                value,
                '~~',
                index + 2,
            );
            if (closeIndex >= 0) {
                flushPlainText();
                for (const run of parseInlineMarkdown(
                    value.slice(index + 2, closeIndex),
                    style,
                )) {
                    appendMarkdownRun(runs, run);
                }
                index = closeIndex + 2;
                continue;
            }
        }

        if (character === '*' && !value.startsWith('**', index)) {
            const closeIndex = findClosingMarkdownMarker(value, '*', index + 1);
            if (closeIndex >= 0) {
                flushPlainText();
                for (const run of parseInlineMarkdown(
                    value.slice(index + 1, closeIndex),
                    { ...style, italic: true },
                )) {
                    appendMarkdownRun(runs, run);
                }
                index = closeIndex + 1;
                continue;
            }
        }

        if (character === '_' && !value.startsWith('__', index)) {
            const closeIndex = findClosingMarkdownMarker(value, '_', index + 1);
            if (closeIndex >= 0) {
                flushPlainText();
                for (const run of parseInlineMarkdown(
                    value.slice(index + 1, closeIndex),
                    { ...style, italic: true },
                )) {
                    appendMarkdownRun(runs, run);
                }
                index = closeIndex + 1;
                continue;
            }
        }

        if (character === '`') {
            const closeIndex = findClosingMarkdownMarker(value, '`', index + 1);
            if (closeIndex >= 0) {
                flushPlainText();
                appendMarkdownRun(runs, {
                    value: value.slice(index + 1, closeIndex),
                    font: markdownInlineFont({ ...style, code: true }),
                    color: colors.muted,
                });
                index = closeIndex + 1;
                continue;
            }
        }

        const htmlBreak = value.slice(index).match(/^<br\s*\/?>/iu);
        if (htmlBreak?.[0]) {
            plainText += ' ';
            index += htmlBreak[0].length;
            continue;
        }

        const htmlTag = value.slice(index).match(/^<\/?[A-Za-z][^>]*>/u);
        if (htmlTag?.[0]) {
            index += htmlTag[0].length;
            continue;
        }

        plainText += character;
        index += 1;
    }

    flushPlainText();
    return runs;
}

function parseMarkdownLink(value: string, startIndex: number) {
    const labelEndIndex = findClosingMarkdownMarker(value, ']', startIndex + 1);
    if (labelEndIndex < 0 || value[labelEndIndex + 1] !== '(') {
        return null;
    }

    const hrefEndIndex = findClosingMarkdownMarker(
        value,
        ')',
        labelEndIndex + 2,
    );
    if (hrefEndIndex < 0) {
        return null;
    }

    return {
        label: value.slice(startIndex + 1, labelEndIndex),
        href: value.slice(labelEndIndex + 2, hrefEndIndex).trim(),
        nextIndex: hrefEndIndex + 1,
    };
}

function findClosingMarkdownMarker(
    value: string,
    marker: string,
    startIndex: number,
) {
    let cursor = startIndex;

    while (cursor < value.length) {
        const markerIndex = value.indexOf(marker, cursor);
        if (markerIndex < 0) {
            return -1;
        }
        if (value[markerIndex - 1] !== '\\') {
            return markerIndex;
        }
        cursor = markerIndex + marker.length;
    }

    return -1;
}

function markdownInlineFont(style: MarkdownInlineStyle): PdfFontKey {
    if (style.bold && style.italic) {
        return 'F4';
    }
    if (style.bold) {
        return 'F2';
    }
    if (style.italic || style.code) {
        return 'F3';
    }

    return 'F1';
}

function appendMarkdownRun(runs: MarkdownTextRun[], run: MarkdownTextRun) {
    if (!run.value) {
        return;
    }

    const previous = runs[runs.length - 1];
    if (
        previous &&
        previous.font === run.font &&
        previous.color === run.color
    ) {
        previous.value += run.value;
        return;
    }

    runs.push({ ...run });
}

function inlineText(value: string) {
    return parseInlineMarkdown(value)
        .map((run) => run.value)
        .join('')
        .trim();
}

function decodeMarkdownEntities(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, codePoint: string) =>
            String.fromCodePoint(Number.parseInt(codePoint, 10)),
        )
        .replace(/&#x([0-9a-f]+);/giu, (_, codePoint: string) =>
            String.fromCodePoint(Number.parseInt(codePoint, 16)),
        );
}

function wrapInlineRuns(
    runs: MarkdownTextRun[],
    maxWidth: number,
    fontSize: number,
) {
    const lines: MarkdownTextRun[][] = [];
    let currentLine: MarkdownTextRun[] = [];
    let currentWidth = 0;
    let pendingSpace = false;

    function pushCurrentLine() {
        if (currentLine.length === 0) {
            return;
        }

        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
        pendingSpace = false;
    }

    for (const run of runs) {
        const tokens = run.value.match(/\s+|\S+/gu) ?? [];
        for (const token of tokens) {
            if (/^\s+$/u.test(token)) {
                pendingSpace = true;
                continue;
            }

            const wordParts =
                measureText(token, fontSize) <= maxWidth
                    ? [token]
                    : splitLongWord(token, maxWidth, fontSize);

            for (const wordPart of wordParts) {
                const prefix =
                    pendingSpace && currentLine.length > 0 ? ' ' : '';
                const value = `${prefix}${wordPart}`;
                const valueWidth = measureText(value, fontSize);

                if (
                    currentLine.length > 0 &&
                    currentWidth + valueWidth > maxWidth
                ) {
                    pushCurrentLine();
                }

                const hasLinePrefix = currentLine.length > 0;
                const outputValue = hasLinePrefix ? value : wordPart;
                appendMarkdownRun(currentLine, {
                    value: outputValue,
                    font: run.font,
                    color: run.color,
                });
                currentWidth += measureText(outputValue, fontSize);
                pendingSpace = false;
            }
        }
    }

    pushCurrentLine();
    return lines;
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
    let escaped = '';

    for (const character of sanitizePdfText(value)) {
        const glyph = latinExtendedGlyphByCharacter.get(character);
        if (glyph) {
            escaped += `\\${glyph.code.toString(8).padStart(3, '0')}`;
            continue;
        }

        if (character === '\\') {
            escaped += '\\\\';
            continue;
        }
        if (character === '(') {
            escaped += '\\(';
            continue;
        }
        if (character === ')') {
            escaped += '\\)';
            continue;
        }

        escaped += character;
    }

    return escaped;
}

function sanitizePdfText(value: string) {
    let sanitized = '';

    for (const character of value
        .normalize('NFC')
        .replace(/[\u00a0\u202f]/g, ' ')
        .replace(/[\u00ad\u200b]/g, '')
        .replace(/[‐‑‒–—―]/g, '-')
        .replace(/[“”„‟]/g, '"')
        .replace(/[‘’‚‛]/g, "'")
        .replace(/[•·]/g, '-')
        .replace(/…/g, '...')
        .replace(/→/g, '->')
        .replace(/←/g, '<-')
        .replace(/×/g, 'x')
        .replace(/≤/g, '<=')
        .replace(/≥/g, '>=')
        .replace(/±/g, '+/-')
        .replace(/°\s*C/giu, ' C')
        .replace(/°/g, '')) {
        if (/^[\x20-\x7e]$/.test(character)) {
            sanitized += character;
            continue;
        }

        if (latinExtendedGlyphByCharacter.has(character)) {
            sanitized += character;
            continue;
        }

        const withoutMarks = character
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        sanitized += /^[\x20-\x7e]+$/.test(withoutMarks) ? withoutMarks : '?';
    }

    return sanitized;
}

function formatNumber(value: number) {
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatColor(color: PdfColor) {
    return [color.r, color.g, color.b].map(formatNumber).join(' ');
}

function writePdf(
    pageContentStreams: string[],
    imageAssets: readonly PdfImageAsset[],
) {
    const objects: Uint8Array[] = [];
    const fontId = 3;
    const boldFontId = 4;
    const italicFontId = 5;
    const boldItalicFontId = 6;
    const fontEncodingId = 7;
    const fontToUnicodeMapId = 8;
    const firstImageObjectId = 9;
    const firstPageObjectId = firstImageObjectId + imageAssets.length;
    const encoder = new TextEncoder();
    const kids = pageContentStreams
        .map((_, index) => `${firstPageObjectId + index * 2} 0 R`)
        .join(' ');
    const xObjectResources =
        imageAssets.length > 0
            ? `/XObject << ${imageAssets
                  .map(
                      (image, index) =>
                          `/${image.name} ${firstImageObjectId + index} 0 R`,
                  )
                  .join(' ')} >>`
            : '';

    objects.push(encodePdfObject('<< /Type /Catalog /Pages 2 0 R >>'));
    objects.push(
        encodePdfObject(
            `<< /Type /Pages /Kids [${kids}] /Count ${pageContentStreams.length} >>`,
        ),
    );
    objects.push(
        encodePdfObject(
            `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding ${fontEncodingId} 0 R /ToUnicode ${fontToUnicodeMapId} 0 R >>`,
        ),
    );
    objects.push(
        encodePdfObject(
            `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding ${fontEncodingId} 0 R /ToUnicode ${fontToUnicodeMapId} 0 R >>`,
        ),
    );
    objects.push(
        encodePdfObject(
            `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding ${fontEncodingId} 0 R /ToUnicode ${fontToUnicodeMapId} 0 R >>`,
        ),
    );
    objects.push(
        encodePdfObject(
            `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding ${fontEncodingId} 0 R /ToUnicode ${fontToUnicodeMapId} 0 R >>`,
        ),
    );
    objects.push(encodePdfObject(pdfLatinExtendedEncodingObject()));
    objects.push(encodePdfObject(pdfLatinExtendedToUnicodeMapObject()));

    imageAssets.forEach((image) => {
        objects.push(pdfImageStreamObject(image));
    });

    pageContentStreams.forEach((content, index) => {
        const pageObjectId = firstPageObjectId + index * 2;
        const contentObjectId = pageObjectId + 1;
        objects.push(
            encodePdfObject(
                [
                    '<< /Type /Page',
                    '/Parent 2 0 R',
                    `/MediaBox [0 0 ${formatNumber(pageWidth)} ${formatNumber(pageHeight)}]`,
                    `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R /F3 ${italicFontId} 0 R /F4 ${boldItalicFontId} 0 R >> ${xObjectResources} >>`,
                    `/Contents ${contentObjectId} 0 R`,
                    '>>',
                ].join(' '),
            ),
        );
        objects.push(pdfStreamObject(deflateSync(encoder.encode(content))));
    });

    const chunks: Uint8Array[] = [encoder.encode('%PDF-1.4\n')];
    let pdfByteLength = chunks[0]?.byteLength ?? 0;
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(pdfByteLength);
        const objectHeader = encoder.encode(`${index + 1} 0 obj\n`);
        const objectFooter = encoder.encode('\nendobj\n');
        chunks.push(objectHeader, object, objectFooter);
        pdfByteLength +=
            objectHeader.byteLength +
            object.byteLength +
            objectFooter.byteLength;
    });

    const xrefOffset = pdfByteLength;
    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
        xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    xref += `startxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(encoder.encode(xref));

    const buffer = new ArrayBuffer(
        chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
    );
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return buffer;
}

function encodePdfObject(value: string) {
    return new TextEncoder().encode(value);
}

function pdfImageStreamObject(image: PdfImageAsset) {
    const encoder = new TextEncoder();
    const content = Buffer.from(image.dataHex, 'hex');

    return concatBytes([
        encoder.encode(
            [
                '<< /Type /XObject',
                '/Subtype /Image',
                `/Width ${image.width}`,
                `/Height ${image.height}`,
                '/ColorSpace /DeviceRGB',
                '/BitsPerComponent 8',
                '/Filter /DCTDecode',
                `/Length ${content.byteLength}`,
                '>>',
                'stream',
                '',
            ].join('\n'),
        ),
        content,
        encoder.encode('\nendstream'),
    ]);
}

function pdfStreamObject(content: Uint8Array) {
    const encoder = new TextEncoder();
    return concatBytes([
        encoder.encode(
            `<< /Length ${content.byteLength} /Filter /FlateDecode >>\nstream\n`,
        ),
        content,
        encoder.encode('\nendstream'),
    ]);
}

function concatBytes(chunks: Uint8Array[]) {
    const result = new Uint8Array(
        chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return result;
}

function pdfLatinExtendedEncodingObject() {
    const firstCode = latinExtendedGlyphs[0]?.code ?? 0x80;
    const glyphNames = latinExtendedGlyphs
        .map((glyph) => `/${glyph.glyph}`)
        .join(' ');

    return `<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [${firstCode} ${glyphNames}] >>`;
}

function pdfLatinExtendedToUnicodeMapObject() {
    const mappings = latinExtendedGlyphs
        .map(
            (glyph) =>
                `<${glyph.code.toString(16).padStart(2, '0').toUpperCase()}> <${glyph.unicode}>`,
        )
        .join('\n');
    const stream = [
        '/CIDInit /ProcSet findresource begin',
        '12 dict begin',
        'begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /GrediceLatinExtended def',
        '/CMapType 2 def',
        '1 begincodespacerange',
        '<00> <FF>',
        'endcodespacerange',
        '1 beginbfrange',
        '<20> <7E> <0020>',
        'endbfrange',
        `${latinExtendedGlyphs.length} beginbfchar`,
        mappings,
        'endbfchar',
        'endcmap',
        'CMapName currentdict /CMap defineresource pop',
        'end',
        'end',
    ].join('\n');

    return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
}
