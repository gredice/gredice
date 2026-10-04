import { useEffect, useMemo } from 'react';
import { CanvasTexture, FrontSide, LinearFilter, SRGBColorSpace } from 'three';

const textureWidth = 512;
const textureHeight = 256;
const horizontalPadding = 42;
const singleLineBaseFontSize = 112;
const doubleLineBaseFontSize = 88;
const minimumFontSize = 32;
const woodenSignInkColor = '#3f2a1d';
const woodenSignFaces = [
    { positionZ: 0.061, rotationY: 0 },
    { positionZ: -0.061, rotationY: Math.PI },
] as const;

function fitFontSize(
    context: CanvasRenderingContext2D,
    lines: string[],
    baseFontSize: number,
) {
    let fontSize = baseFontSize;
    const maximumWidth = textureWidth - horizontalPadding * 2;

    while (fontSize > minimumFontSize) {
        context.font = `700 ${fontSize}px Arial, sans-serif`;
        const widestLine = Math.max(
            ...lines.map((line) => context.measureText(line).width),
        );
        if (widestLine <= maximumWidth) {
            break;
        }
        fontSize -= 2;
    }

    return fontSize;
}

function createWoodenSignTextTexture(message: string) {
    const canvas = document.createElement('canvas');
    canvas.width = textureWidth;
    canvas.height = textureHeight;
    const context = canvas.getContext('2d');

    if (context && message.length > 0) {
        const lines = message.split('\n').slice(0, 2);
        const fontSize = fitFontSize(
            context,
            lines,
            lines.length === 1
                ? singleLineBaseFontSize
                : doubleLineBaseFontSize,
        );
        context.clearRect(0, 0, textureWidth, textureHeight);
        context.fillStyle = woodenSignInkColor;
        context.font = `700 ${fontSize}px Arial, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineJoin = 'round';

        const lineCenters =
            lines.length === 1
                ? [textureHeight / 2]
                : [textureHeight * 0.34, textureHeight * 0.68];
        lines.forEach((line, index) => {
            context.fillText(
                line,
                textureWidth / 2,
                lineCenters[index] ?? textureHeight / 2,
            );
        });
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

export function WoodenSignText({ message }: { message: string }) {
    const texture = useMemo(
        () => createWoodenSignTextTexture(message),
        [message],
    );

    useEffect(() => () => texture.dispose(), [texture]);

    if (message.length === 0) {
        return null;
    }

    return woodenSignFaces.map(({ positionZ, rotationY }) => (
        <mesh
            key={positionZ}
            name="WoodenSign:Message"
            position={[0, 0.93, positionZ]}
            rotation={[0, rotationY, 0]}
            renderOrder={1}
            raycast={() => null}
        >
            <planeGeometry args={[0.72, 0.34]} />
            <meshBasicMaterial
                map={texture}
                transparent
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-1}
                side={FrontSide}
                toneMapped={false}
            />
        </mesh>
    ));
}
