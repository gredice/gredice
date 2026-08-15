'use client';

import { Sprout } from '@gredice/ui/icons';
import { Center, Html, Text3D } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Euler, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
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
    usePublicGardenVisualOccluders,
} from './PublicGardenViewer';

const outletProductSignCurrencyFormatter = new Intl.NumberFormat('hr-HR', {
    currency: 'EUR',
    style: 'currency',
});
const outletProductSignScale = 0.9;
const outletProductSignFaceDistanceFactor = 1;
const outletProductSignTypefaceUrl =
    '/assets/fonts/outlet-sign-bold.typeface.json';
// Keep the HTML image and variety label just ahead of the wooden frame so the
// content stays clear of the board surface without visually floating.
const outletProductSignFaceDepth = 0.061;
// Raycast above the board so the sign's own display table and pot cannot hide
// its face. The DOM content is translated back onto the wooden board below.
const outletProductSignOcclusionProbeOffsetY = 0.23;
const outletProductSignFaceCssOffsetY =
    (outletProductSignOcclusionProbeOffsetY /
        outletProductSignFaceDistanceFactor) *
    400;
const outletProductSignPriceTagColor = '#bf4b2f';
const outletProductSignPriceTagEdgeColor = '#74301f';
const outletProductSignPriceTextColor = '#fff4ce';
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
 * Builds stable product-sign content from scene offers. A plant sort can have
 * more than one sowing-date offer, so its sign shows the lowest live price or
 * a sold-out state when none of its offers have stock.
 */
export function getOutletGardenProductSignProducts(
    offers: readonly OutletOfferData[],
) {
    const offersByPlantSortId = new Map<number, OutletOfferData[]>();

    for (const offer of offers.toSorted((left, right) => left.id - right.id)) {
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
        const availableOffers = sortOffers.filter(
            (offer) => offer.remainingQuantity > 0,
        );
        const prices = availableOffers.map((offer) => offer.outletPrice);
        const minimumPrice = prices.length ? Math.min(...prices) : null;
        const allPricesEqual = prices.every((price) => price === minimumPrice);
        const formattedPrice =
            minimumPrice !== null
                ? outletProductSignCurrencyFormatter.format(minimumPrice)
                : null;

        return {
            imageUrl: plantSortImageUrl ?? offerImageUrl,
            name: firstOffer.plantSort.name,
            plantSortId,
            priceLabel:
                formattedPrice === null
                    ? 'Rasprodano'
                    : allPricesEqual
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
                className="grid size-[106px] shrink-0 place-items-center rounded-[8px] bg-[#dce8be] text-[#50713a] ring-[3px] ring-[#58391f]/35"
                data-outlet-garden-product-sign-image-fallback
            >
                <Sprout className="size-[48px]" />
            </span>
        );
    }

    return (
        // biome-ignore lint/performance/noImgElement: Outlet images are API-provided and can use administrator-configured origins that are valid in the DOM but not as WebGL textures.
        <img
            alt=""
            className="size-[106px] shrink-0 rounded-[8px] object-cover ring-[3px] ring-[#58391f]/35"
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
            className="pointer-events-none flex h-[116px] w-[264px] items-center gap-[12px] overflow-visible bg-transparent p-[5px] text-[#352519]"
            data-outlet-garden-product-sign={product.plantSortId}
            data-outlet-garden-product-sign-depth={outletProductSignFaceDepth}
            data-outlet-garden-product-sign-front-only
            data-outlet-garden-product-sign-scale={outletProductSignScale}
            data-outlet-garden-product-sign-name={product.name}
            data-outlet-garden-product-sign-occlusion="visual-targets"
            data-outlet-garden-product-sign-price={product.priceLabel}
            data-outlet-garden-product-sign-price-renderer="text3d"
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
            <span className="flex min-w-0 flex-1 items-end self-stretch pb-[7px]">
                <span
                    className="line-clamp-3 rounded-[5px] bg-[#40562c]/90 px-[5px] py-[4px] text-[16px] leading-[1.05] font-extrabold tracking-[-0.01em] text-[#fff4ce]"
                    style={{
                        textShadow: '0 1px 2px rgb(38 28 17 / 48%)',
                    }}
                >
                    {product.name}
                </span>
            </span>
        </div>
    );
}

function outletProductSignPriceFontSize(priceLabel: string) {
    if (priceLabel.length >= 10) {
        return 0.046;
    }
    if (priceLabel.length >= 8) {
        return 0.052;
    }
    return 0.066;
}

function OutletGardenProductSignPriceText({
    back = false,
    priceLabel,
}: {
    back?: boolean;
    priceLabel: string;
}) {
    return (
        <group
            position={[0, -0.005, back ? -0.061 : 0.061]}
            rotation={[0, back ? Math.PI : 0, 0]}
        >
            <Center cacheKey={priceLabel} disableZ>
                <Text3D
                    bevelEnabled
                    bevelSegments={2}
                    bevelSize={0.0025}
                    bevelThickness={0.003}
                    castShadow
                    curveSegments={5}
                    font={outletProductSignTypefaceUrl}
                    height={0.018}
                    raycast={() => null}
                    size={outletProductSignPriceFontSize(priceLabel)}
                >
                    {priceLabel}
                    <meshStandardMaterial
                        color={outletProductSignPriceTextColor}
                        metalness={0.04}
                        roughness={0.48}
                    />
                </Text3D>
            </Center>
        </group>
    );
}

function OutletGardenProductSignPriceTag({
    product,
}: {
    product: OutletGardenProductSignProduct;
}) {
    return (
        <group
            name={`OutletGardenProductSignPriceTag:${product.plantSortId.toString()}`}
            position={[0.29, 1.105, 0]}
            rotation={[0, 0, -0.075]}
        >
            <mesh castShadow raycast={() => null} receiveShadow>
                <boxGeometry args={[0.46, 0.2, 0.105]} />
                <meshStandardMaterial
                    color={outletProductSignPriceTagEdgeColor}
                    roughness={0.74}
                />
            </mesh>
            <mesh position={[0, 0, 0.055]} raycast={() => null}>
                <planeGeometry args={[0.43, 0.17]} />
                <meshStandardMaterial
                    color={outletProductSignPriceTagColor}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    roughness={0.7}
                />
            </mesh>
            <mesh
                position={[0, 0, -0.055]}
                rotation={[0, Math.PI, 0]}
                raycast={() => null}
            >
                <planeGeometry args={[0.43, 0.17]} />
                <meshStandardMaterial
                    color={outletProductSignPriceTagColor}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    roughness={0.7}
                />
            </mesh>
            <OutletGardenProductSignPriceText priceLabel={product.priceLabel} />
            <OutletGardenProductSignPriceText
                back
                priceLabel={product.priceLabel}
            />
        </group>
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
    const visualOccluders = usePublicGardenVisualOccluders();
    const occlusionTargets = useMemo(
        () =>
            visualOccluders
                ? [
                      {
                          current: visualOccluders,
                      },
                  ]
                : null,
        [visualOccluders],
    );
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
                        occlude={occlusionTargets ?? 'raycast'}
                        pointerEvents="none"
                        position={[
                            0,
                            0.93 + outletProductSignOcclusionProbeOffsetY,
                            outletProductSignFaceDepth,
                        ]}
                        style={{
                            backfaceVisibility: 'hidden',
                            pointerEvents: 'none',
                            transform: `translateY(${outletProductSignFaceCssOffsetY.toString()}px)`,
                            WebkitBackfaceVisibility: 'hidden',
                        }}
                        zIndexRange={[2, 0]}
                    >
                        <OutletGardenProductSignFace product={product} />
                    </Html>
                    <OutletGardenProductSignPriceTag product={product} />
                </group>
            ))}
        </group>
    );
}
