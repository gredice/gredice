import { Buffer } from 'node:buffer';

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
// Binary plist for Apple's Dynamic Desktop solar metadata. The image indexes
// match macOSDynamicWallpaperPhases. Anchors straddle the twilight boundaries
// at -6° and 6° altitude so each phase starts as the sun crosses a boundary.
// ap: { l: 0, d: 2 } (light: day, dark: night)
// si entries (z: azimuth, a: altitude, i: image index):
//   east (90°):  (-6.5, 2), (-5.5, 3), (5.5, 3), (6.5, 0)
//   west (270°): (6.5, 0), (5.5, 1), (-5.5, 1), (-6.5, 2)
const solarPropertyList =
    'YnBsaXN0MDDSAQIDCFJhcFJzadIEBQYHUWRRbBACEACoCQ8SFBYYGhvTCgsMDQYOUWFRaVF6I8AaAAAAAAAAI0BWgAAAAAAA0woLDBARDiPAFgAAAAAAABAD0woLDBMRDiNAFgAAAAAAANMKCwwVBw4jQBoAAAAAAADTCgsMFQcXI0Bw4AAAAAAA0woLDBMZFxAB0woLDBAZF9MKCwwNBhcIDRATGBocHiApMDI0Nj9IT1haYWpxeoGKkZOaAAAAAAAAAQEAAAAAAAAAHAAAAAAAAAAAAAAAAAAAAKE=';

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
        `         <apple_desktop:solar>${solarPropertyList}</apple_desktop:solar>`,
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
    return Buffer.from(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
    ).includes(macOSDynamicWallpaperXmp());
}

export function hasMacOSDynamicWallpaperFrames(info: string) {
    const [, primary, ...otherFrames] = info.split(/^image: /m);
    return (
        primary !== undefined &&
        otherFrames.length + 1 === macOSDynamicWallpaperPhases.length &&
        /^.+, primary\r?$/m.test(primary) &&
        /^[ \t]*XMP: [1-9]\d* bytes\b/m.test(primary)
    );
}
