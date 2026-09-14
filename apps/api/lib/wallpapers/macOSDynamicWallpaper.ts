export const macOSDynamicWallpaperPhases = [
    'day',
    'evening',
    'night',
    'morning',
] as const;

export type MacOSDynamicWallpaperPhase =
    (typeof macOSDynamicWallpaperPhases)[number];

export const macOSDynamicWallpaperSizes = {
    fullHd: { height: 1080, width: 1920 },
    uhd: { height: 2160, width: 3840 },
    ultrawide: { height: 1440, width: 3440 },
} as const;

export type MacOSDynamicWallpaperSize = keyof typeof macOSDynamicWallpaperSizes;

const pngSignature = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const pngHeaderLength = 33;
const xmpKeyword = 'XML:com.adobe.xmp';
// Native schedule indexes follow macOS wallpaper order: day (10:00),
// evening (18:00), night (21:00), and morning (06:00). Day is the light
// appearance and night is the dark appearance.
const dynamicWallpaperPropertyList =
    'YnBsaXN0MDDSAQIDElJ0aVJhcKQECQwP0gUGBwhRdFFpIz/aqqqqqqqrEADSBQYKCyM/6AAAAAAAABAB0gUGDQ4jP+wAAAAAAAAQAtIFBhARIz/QAAAAAAAAEAPSExQOCFFkUWwIDRATGB0fISosMTo8QUpMUVpcYWMAAAAAAAABAQAAAAAAAAAVAAAAAAAAAAAAAAAAAAAAZQ==';

const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
});

function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function concatenate(parts: ReadonlyArray<Uint8Array>) {
    const output = new Uint8Array(
        parts.reduce((length, part) => length + part.byteLength, 0),
    );
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
    }
    return output;
}

function createPngChunk(type: string, data: Uint8Array) {
    const typeBytes = new TextEncoder().encode(type);
    const output = new Uint8Array(12 + data.byteLength);
    const view = new DataView(output.buffer);
    view.setUint32(0, data.byteLength);
    output.set(typeBytes, 4);
    output.set(data, 8);
    view.setUint32(8 + data.byteLength, crc32(concatenate([typeBytes, data])));
    return output;
}

function hasPngSignature(bytes: Uint8Array) {
    return pngSignature.every((byte, index) => bytes[index] === byte);
}

function isPngHeader(bytes: Uint8Array) {
    if (bytes.byteLength < pngHeaderLength || !hasPngSignature(bytes)) {
        return false;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return (
        view.getUint32(8) === 13 &&
        new TextDecoder().decode(bytes.subarray(12, 16)) === 'IHDR'
    );
}

export function readPngDimensions(bytes: Uint8Array) {
    if (!isPngHeader(bytes)) {
        return null;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width === 0 || height === 0) {
        return null;
    }
    return { height, width };
}

export function macOSDynamicWallpaperXmp() {
    return [
        '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Gredice">',
        '   <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
        '      <rdf:Description rdf:about="" xmlns:apple_desktop="http://ns.apple.com/namespace/1.0/">',
        `         <apple_desktop:h24>${dynamicWallpaperPropertyList}</apple_desktop:h24>`,
        '      </rdf:Description>',
        '   </rdf:RDF>',
        '</x:xmpmeta>',
    ].join('\n');
}

export function addMacOSDynamicWallpaperXmp(bytes: Uint8Array) {
    if (!isPngHeader(bytes)) {
        throw new Error('Datoteka nije valjana PNG slika.');
    }

    const text = new TextEncoder().encode(macOSDynamicWallpaperXmp());
    const keyword = new TextEncoder().encode(xmpKeyword);
    const chunkData = concatenate([
        keyword,
        new Uint8Array([0, 0, 0, 0, 0]),
        text,
    ]);
    const xmpChunk = createPngChunk('iTXt', chunkData);

    return concatenate([
        bytes.subarray(0, pngHeaderLength),
        xmpChunk,
        bytes.subarray(pngHeaderLength),
    ]);
}

export function hasMacOSDynamicWallpaperMetadata(bytes: Uint8Array) {
    const metadataMarker = new TextEncoder().encode('apple_desktop:h24');
    outer: for (
        let index = 0;
        index <= bytes.byteLength - metadataMarker.byteLength;
        index += 1
    ) {
        for (let offset = 0; offset < metadataMarker.byteLength; offset += 1) {
            if (bytes[index + offset] !== metadataMarker[offset]) {
                continue outer;
            }
        }
        return true;
    }
    return false;
}
