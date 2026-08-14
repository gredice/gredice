'use client';

import { Sprout } from '@gredice/ui/icons';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Euler,
    FrontSide,
    type InstancedMesh,
    Matrix4,
    Quaternion,
    Vector3,
} from 'three';
import { blockInteractionPassthroughUserDataKey } from '../controls/BlockInteractionResolver';
import { useBlockData } from '../hooks/useBlockData';
import type { OutletOfferData } from '../hooks/useOutletOffers';
import type { GLTFResult } from '../models/GameAssets';
import { getStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    getOutletGardenOfferPlacement,
    type OutletGardenProductSignPlacement,
} from './outletGardenLayout';
import {
    normalizePublicGardenStacks,
    type PublicGardenDetail,
    publicGardenStacksFromResponse,
} from './PublicGardenViewer';

const outletProductSignCurrencyFormatter = new Intl.NumberFormat('hr-HR', {
    currency: 'EUR',
    style: 'currency',
});
const outletProductSignScale = 0.9;
const outletProductSignFaceDistanceFactor = 1;
// The inset board's front face is z=0.0215; keep the card just above it and
// behind the surrounding frame, whose front edge reaches z=0.05.
const outletProductSignFaceDepth = 0.0225;
const woodenSignNodeNames = [
    'WoodenSign_Post',
    'WoodenSign_Board',
    'WoodenSign_Frame',
    'WoodenSign_Fasteners',
] satisfies Extract<keyof GLTFResult['nodes'], `WoodenSign_${string}`>[];

export type OutletGardenProductSignProduct = {
    imageUrl: string | null;
    name: string;
    plantSortId: number;
    priceLabel: string;
};

function firstNonEmptyImageUrl(urls: readonly (string | null)[]) {
    return urls.find((url): url is string => Boolean(url?.trim())) ?? null;
}

/**
 * Builds stable product-sign content from live offers. A plant sort can have
 * more than one sowing-date offer, so its sign shows the lowest price when the
 * active offers do not all share one price.
 */
export function getOutletGardenProductSignProducts(
    offers: readonly OutletOfferData[],
) {
    const liveOffers = offers
        .filter((offer) => offer.remainingQuantity > 0)
        .toSorted((left, right) => left.id - right.id);
    const offersByPlantSortId = new Map<number, OutletOfferData[]>();

    for (const offer of liveOffers) {
        const sortOffers = offersByPlantSortId.get(offer.plantSort.id) ?? [];
        sortOffers.push(offer);
        offersByPlantSortId.set(offer.plantSort.id, sortOffers);
    }

    return Array.from(offersByPlantSortId, ([plantSortId, sortOffers]) => {
        const firstOffer = sortOffers[0];
        if (!firstOffer) {
            return null;
        }

        const plantSortImageUrl = firstNonEmptyImageUrl(
            sortOffers.map((offer) => offer.plantSort.imageUrl),
        );
        const offerImageUrl = firstNonEmptyImageUrl(
            sortOffers.flatMap((offer) => offer.imageUrls),
        );
        const prices = sortOffers.map((offer) => offer.outletPrice);
        const minimumPrice = Math.min(...prices);
        const allPricesEqual = prices.every((price) => price === minimumPrice);
        const formattedPrice =
            outletProductSignCurrencyFormatter.format(minimumPrice);

        return {
            imageUrl: plantSortImageUrl ?? offerImageUrl,
            name: firstOffer.plantSort.name,
            plantSortId,
            priceLabel: allPricesEqual
                ? formattedPrice
                : `od ${formattedPrice}`,
        } satisfies OutletGardenProductSignProduct;
    })
        .filter(
            (product): product is OutletGardenProductSignProduct =>
                product !== null,
        )
        .sort((left, right) => left.plantSortId - right.plantSortId);
}

function OutletGardenProductSignImage({
    imageUrl,
    name,
}: Pick<OutletGardenProductSignProduct, 'imageUrl' | 'name'>) {
    const [failed, setFailed] = useState(false);

    if (!imageUrl || failed) {
        return (
            <span
                aria-hidden="true"
                className="grid size-[92px] shrink-0 place-items-center rounded-[10px] bg-[#e4edcf] text-[#50713a] ring-[3px] ring-[#765032]/20"
                data-outlet-garden-product-sign-image-fallback
            >
                <Sprout className="size-[44px]" />
            </span>
        );
    }

    return (
        // biome-ignore lint/performance/noImgElement: Outlet images are API-provided and can use administrator-configured origins that are valid in the DOM but not as WebGL textures.
        <img
            alt=""
            className="size-[92px] shrink-0 rounded-[10px] object-cover ring-[3px] ring-[#765032]/20"
            data-outlet-garden-product-sign-image
            decoding="async"
            draggable={false}
            loading="lazy"
            onError={() => setFailed(true)}
            src={imageUrl}
            title={name}
        />
    );
}

function OutletGardenProductSignFace({
    product,
}: {
    product: OutletGardenProductSignProduct;
}) {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none flex h-[124px] w-[276px] items-center gap-[10px] overflow-hidden rounded-[12px] border-[4px] border-[#765032]/45 bg-[#fff8dc] p-[8px] text-[#352519]"
            data-outlet-garden-product-sign={product.plantSortId}
            data-outlet-garden-product-sign-depth={outletProductSignFaceDepth}
            data-outlet-garden-product-sign-front-only
            data-outlet-garden-product-sign-scale={outletProductSignScale}
            data-outlet-garden-product-sign-name={product.name}
            data-outlet-garden-product-sign-price={product.priceLabel}
            style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
            }}
        >
            <OutletGardenProductSignImage
                key={product.imageUrl ?? 'image-fallback'}
                imageUrl={product.imageUrl}
                name={product.name}
            />
            <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-[8px]">
                <span className="line-clamp-2 text-[23px] leading-[1.05] font-extrabold tracking-[-0.02em]">
                    {product.name}
                </span>
                <span className="rounded-full bg-[#47672f] px-[12px] py-[4px] text-[25px] leading-none font-black whitespace-nowrap text-white shadow-sm">
                    {product.priceLabel}
                </span>
            </span>
        </div>
    );
}

function OutletGardenProductSignMeshInstances({
    nodes,
    signs,
}: {
    nodes: GLTFResult['nodes'];
    signs: readonly ResolvedOutletGardenProductSign[];
}) {
    return woodenSignNodeNames.map((nodeName) => (
        <OutletGardenProductSignMeshBatch
            key={nodeName}
            node={nodes[nodeName]}
            signs={signs}
        />
    ));
}

type ResolvedOutletGardenProductSign = {
    baseY: number;
    placement: OutletGardenProductSignPlacement;
    product: OutletGardenProductSignProduct;
};

function OutletGardenProductSignMeshBatch({
    node,
    signs,
}: {
    node: GLTFResult['nodes'][Extract<
        keyof GLTFResult['nodes'],
        `WoodenSign_${string}`
    >];
    signs: readonly ResolvedOutletGardenProductSign[];
}) {
    const meshRef = useRef<InstancedMesh>(null);

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        const nodeMatrix = new Matrix4().compose(
            node.position,
            node.quaternion,
            node.scale,
        );
        const signPosition = new Vector3();
        const signRotation = new Quaternion();
        const signEuler = new Euler();
        const signScale = new Vector3(
            outletProductSignScale,
            outletProductSignScale,
            outletProductSignScale,
        );
        const instanceMatrix = new Matrix4();

        for (const [index, { baseY, placement }] of signs.entries()) {
            signPosition.set(placement.x, baseY, placement.y);
            signEuler.set(0, placement.rotation * (Math.PI / 2), 0);
            signRotation.setFromEuler(signEuler);
            instanceMatrix
                .compose(signPosition, signRotation, signScale)
                .multiply(nodeMatrix);
            mesh.setMatrixAt(index, instanceMatrix);
        }

        mesh.count = signs.length;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [node, signs]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[node.geometry, node.material, signs.length]}
            castShadow
            name={`OutletGardenProductSignInstances:${node.name}`}
            raycast={() => null}
            receiveShadow
        />
    );
}

export function OutletGardenProductSigns({
    offers,
    placements,
    stacks,
}: {
    offers: readonly OutletOfferData[];
    placements: readonly OutletGardenProductSignPlacement[];
    stacks: PublicGardenDetail['stacks'];
}) {
    const { nodes } = useGameGLTF('WoodenSign');
    const { data: blockData } = useBlockData();
    const products = useMemo(
        () => getOutletGardenProductSignProducts(offers),
        [offers],
    );
    const resolvedSigns = useMemo(() => {
        if (!blockData) {
            return [];
        }

        const productByPlantSortId = new Map(
            products.map((product) => [product.plantSortId, product]),
        );
        const normalizedStacks = normalizePublicGardenStacks(
            publicGardenStacksFromResponse(stacks),
        );
        const stacksByPosition = new Map(
            normalizedStacks.map((stack) => [
                `${stack.position.x.toString()}|${stack.position.z.toString()}`,
                stack,
            ]),
        );

        return placements.flatMap((placement) => {
            const product = productByPlantSortId.get(placement.plantSortId);
            const anchorPosition = getOutletGardenOfferPlacement(
                placement.anchorSlotIndex,
            );
            const anchorStack = stacksByPosition.get(
                `${anchorPosition.x.toString()}|${anchorPosition.y.toString()}`,
            );
            if (!product || !anchorStack) {
                return [];
            }

            const anchorBlock = anchorStack.blocks.find(
                (block) => block.id === placement.anchorBlockId,
            );
            return [
                {
                    baseY: getStackHeight(blockData, anchorStack, anchorBlock),
                    placement,
                    product,
                } satisfies ResolvedOutletGardenProductSign,
            ];
        });
    }, [blockData, placements, products, stacks]);

    useFrame(({ gl }) => {
        if (resolvedSigns.length === 0) {
            return;
        }

        // Drei Html instances share these canvas styles. A later non-blending
        // avatar label can reset them, so retain the blending layer while any
        // product sign is visible in the scene.
        const canvasStyle = gl.domElement.style;
        if (canvasStyle.zIndex !== '1') {
            canvasStyle.zIndex = '1';
        }
        if (canvasStyle.position !== 'absolute') {
            canvasStyle.position = 'absolute';
        }
        if (canvasStyle.pointerEvents !== 'none') {
            canvasStyle.pointerEvents = 'none';
        }
    });

    if (resolvedSigns.length === 0) {
        return null;
    }

    return (
        <group
            name="OutletGardenProductSigns"
            userData={{ [blockInteractionPassthroughUserDataKey]: true }}
        >
            <OutletGardenProductSignMeshInstances
                nodes={nodes}
                signs={resolvedSigns}
            />
            {resolvedSigns.map(({ baseY, placement, product }) => (
                <group
                    key={placement.id}
                    name={`OutletGardenProductSign:${placement.plantSortId.toString()}`}
                    position={[placement.x, baseY, placement.y]}
                    rotation={[0, placement.rotation * (Math.PI / 2), 0]}
                    scale={outletProductSignScale}
                >
                    <Html
                        transform
                        distanceFactor={outletProductSignFaceDistanceFactor}
                        material={
                            // Blending occlusion uses this zero-alpha plane as
                            // the DOM window. FrontSide keeps that window shut
                            // when the wooden sign is viewed from behind.
                            <meshBasicMaterial
                                depthTest
                                depthWrite
                                opacity={0}
                                side={FrontSide}
                                toneMapped={false}
                            />
                        }
                        occlude="blending"
                        pointerEvents="none"
                        position={[0, 0.93, outletProductSignFaceDepth]}
                        style={{
                            backfaceVisibility: 'hidden',
                            pointerEvents: 'none',
                            WebkitBackfaceVisibility: 'hidden',
                        }}
                        zIndexRange={[3, 0]}
                    >
                        <OutletGardenProductSignFace product={product} />
                    </Html>
                </group>
            ))}
        </group>
    );
}
