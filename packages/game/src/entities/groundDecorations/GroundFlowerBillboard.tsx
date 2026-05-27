'use client';

import { Billboard } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import {
    CanvasTexture,
    ClampToEdgeWrapping,
    Color,
    LinearFilter,
    LinearMipmapLinearFilter,
    PlaneGeometry,
    SRGBColorSpace,
} from 'three';
import { getSpriteBrightness } from '../../sprites/spriteLighting';
import { useGameState } from '../../useGameState';

const flowerTextureCache = new Map<string, CanvasTexture>();
const flowerAspect = 1.35;

type GroundFlowerBillboardProps = {
    color: string;
    height: number;
    opacity: number;
    position: [number, number, number];
    renderOrder?: number;
    rotation: number;
};

function drawStem(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    height: number,
) {
    context.save();
    context.strokeStyle = 'rgba(61, 130, 42, 0.82)';
    context.lineCap = 'round';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, 116);
    context.quadraticCurveTo(x - 4, 106 - height * 0.25, x, y + 4);
    context.stroke();
    context.restore();
}

function drawFlower(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
) {
    drawStem(context, x, y, radius);

    context.save();
    context.translate(x, y);

    for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * Math.PI * 2;
        context.save();
        context.rotate(angle);
        context.fillStyle = color;
        context.beginPath();
        context.ellipse(
            radius * 0.72,
            0,
            radius * 0.58,
            radius * 0.34,
            0,
            0,
            Math.PI * 2,
        );
        context.fill();
        context.restore();
    }

    context.fillStyle = 'rgba(245, 190, 55, 0.95)';
    context.beginPath();
    context.arc(0, 0, radius * 0.32, 0, Math.PI * 2);
    context.fill();
    context.restore();
}

function createFlowerTexture(color: string) {
    if (typeof document === 'undefined') {
        return null;
    }

    const cachedTexture = flowerTextureCache.get(color);
    if (cachedTexture) {
        return cachedTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawFlower(context, 43, 83, 8, color);
    drawFlower(context, 69, 72, 11, color);
    drawFlower(context, 91, 91, 7, color);

    const texture = new CanvasTexture(canvas);
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    flowerTextureCache.set(color, texture);

    return texture;
}

export function GroundFlowerBillboard({
    color,
    height,
    opacity,
    position,
    renderOrder,
    rotation,
}: GroundFlowerBillboardProps) {
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const weather = useGameState((state) => state.weather);
    const texture = useMemo(() => createFlowerTexture(color), [color]);
    const brightness = getSpriteBrightness(timeOfDay, weather);
    const materialColor = useMemo(() => {
        return new Color().setScalar(brightness);
    }, [brightness]);
    const geometry = useMemo(() => {
        const planeGeometry = new PlaneGeometry(height * flowerAspect, height);
        planeGeometry.translate(0, height / 2, 0);
        return planeGeometry;
    }, [height]);

    useEffect(() => {
        return () => {
            geometry.dispose();
        };
    }, [geometry]);

    if (!texture) {
        return null;
    }

    return (
        <Billboard follow position={position}>
            <mesh
                receiveShadow
                renderOrder={renderOrder}
                rotation={[0, 0, rotation]}
            >
                <primitive attach="geometry" object={geometry} />
                <meshBasicMaterial
                    alphaTest={0.05}
                    color={materialColor}
                    depthWrite={false}
                    map={texture}
                    opacity={opacity}
                    transparent
                />
            </mesh>
        </Billboard>
    );
}
