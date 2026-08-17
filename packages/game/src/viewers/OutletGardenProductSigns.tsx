'use client';

import { Sprout } from '@gredice/ui/icons';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
    type ComponentProps,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Euler,
    type Group,
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
    usePublicGardenVisualOccluders,
} from './PublicGardenViewer';

const outletProductSignCurrencyFormatter = new Intl.NumberFormat('hr-HR', {
    currency: 'EUR',
    style: 'currency',
});
const outletProductSignScale = 0.9;
const outletProductSignFaceDistanceFactor = 1;
// The inset board faces are at +/-0.0215. Keep each content face just above its
// board while remaining clearly behind the surrounding frame at +/-0.05.
const outletProductSignFaceDepth = 0.0225;
// Raycast above the board so the sign's own display table and pot cannot hide
// its face. The DOM content is translated back onto the wooden board below.
const outletProductSignOcclusionProbeOffsetY = 0.5;
const outletProductSignFaceCssOffsetY =
    (outletProductSignOcclusionProbeOffsetY /
        outletProductSignFaceDistanceFactor) *
    400;
const outletProductSignPriceTagColor = '#bf4b2f';
const outletProductSignPriceTagEdgeColor = '#74301f';
const outletProductSignPriceTextSurfaceDepth = 0.056;
const outletProductSignFrontNormal = new Vector3(0, 0, 1);
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

type OutletGardenProductSignFaceSide = 'back' | 'front';

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
                className="grid size-[112px] shrink-0 place-items-center rounded-[6px] bg-[#dce8be] text-[#50713a]"
                data-outlet-garden-product-sign-image-fallback
            >
                <Sprout className="size-[52px]" />
            </span>
        );
    }

    return (
        // biome-ignore lint/performance/noImgElement: Outlet images are API-provided and can use administrator-configured origins that are valid in the DOM but not as WebGL textures.
        <img
            alt=""
            className="size-[112px] shrink-0 rounded-[6px] object-cover"
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
    face,
    product,
}: {
    face: OutletGardenProductSignFaceSide;
    product: OutletGardenProductSignProduct;
}) {
    const isFront = face === 'front';

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none flex h-[116px] w-[264px] items-center gap-[8px] overflow-visible bg-transparent p-[2px] text-[#352519]"
            data-outlet-garden-product-sign={product.plantSortId}
            data-outlet-garden-product-sign-back={
                isFront ? undefined : product.plantSortId
            }
            data-outlet-garden-product-sign-depth={
                isFront
                    ? outletProductSignFaceDepth
                    : -outletProductSignFaceDepth
            }
            data-outlet-garden-product-sign-face={face}
            data-outlet-garden-product-sign-scale={outletProductSignScale}
            data-outlet-garden-product-sign-name={product.name}
            data-outlet-garden-product-sign-occlusion="visual-targets"
            data-outlet-garden-product-sign-occlusion-probe-offset={
                outletProductSignOcclusionProbeOffsetY
            }
            data-outlet-garden-product-sign-price={product.priceLabel}
            data-outlet-garden-product-sign-price-renderer="dom-overlay"
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
            <span className="flex min-w-0 flex-1 items-end self-stretch pb-[5px]">
                <span
                    className="line-clamp-3 rounded-[5px] bg-[#40562c]/90 px-[6px] py-[4px] text-[18px] leading-[1.04] font-extrabold tracking-[-0.01em] text-[#fff4ce]"
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
        return 22;
    }
    if (priceLabel.length >= 8) {
        return 25;
    }
    return 30;
}

function OutletGardenProductSignPriceTag({
    product,
}: {
    product: OutletGardenProductSignProduct;
}) {
    return (
        <group
            name={`OutletGardenProductSignPriceTag:${product.plantSortId.toString()}`}
            position={[0.29, 1.24, 0]}
            rotation={[0, 0, -0.02]}
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
        </group>
    );
}

function OutletGardenProductSignFaces({
    occlude,
    product,
}: {
    occlude: ComponentProps<typeof Html>['occlude'];
    product: OutletGardenProductSignProduct;
}) {
    const groupRef = useRef<Group>(null);
    const [visibleFace, setVisibleFace] =
        useState<OutletGardenProductSignFaceSide>('front');
    const lastVisibleFaceRef = useRef<OutletGardenProductSignFaceSide | null>(
        null,
    );
    const cameraPositionRef = useRef(new Vector3());
    const signPositionRef = useRef(new Vector3());
    const signQuaternionRef = useRef(new Quaternion());
    const signNormalRef = useRef(new Vector3());
    const toCameraRef = useRef(new Vector3());

    useFrame(({ camera }) => {
        const group = groupRef.current;
        if (!group) {
            return;
        }

        group.getWorldPosition(signPositionRef.current);
        group.getWorldQuaternion(signQuaternionRef.current);
        camera.getWorldPosition(cameraPositionRef.current);
        signNormalRef.current
            .copy(outletProductSignFrontNormal)
            .applyQuaternion(signQuaternionRef.current);
        toCameraRef.current
            .copy(cameraPositionRef.current)
            .sub(signPositionRef.current);
        const visibleFace =
            signNormalRef.current.dot(toCameraRef.current) >= 0
                ? 'front'
                : 'back';
        if (lastVisibleFaceRef.current === visibleFace) {
            return;
        }

        lastVisibleFaceRef.current = visibleFace;
        setVisibleFace(visibleFace);
    });

    const isFront = visibleFace === 'front';
    const priceFontSize = outletProductSignPriceFontSize(product.priceLabel);
    return (
        <group ref={groupRef}>
            <Html
                transform
                distanceFactor={outletProductSignFaceDistanceFactor}
                occlude={occlude}
                pointerEvents="none"
                position={[
                    0,
                    0.93 + outletProductSignOcclusionProbeOffsetY,
                    isFront
                        ? outletProductSignFaceDepth
                        : -outletProductSignFaceDepth,
                ]}
                rotation={[0, isFront ? 0 : Math.PI, 0]}
                style={{
                    backfaceVisibility: 'hidden',
                    pointerEvents: 'none',
                    transform: `translateY(${outletProductSignFaceCssOffsetY.toString()}px)`,
                    WebkitBackfaceVisibility: 'hidden',
                }}
                zIndexRange={[2, 0]}
            >
                <OutletGardenProductSignFace
                    face={visibleFace}
                    product={product}
                />
            </Html>
            <Html
                transform
                distanceFactor={outletProductSignFaceDistanceFactor}
                pointerEvents="none"
                position={[
                    0.29,
                    1.24 + outletProductSignOcclusionProbeOffsetY,
                    isFront
                        ? outletProductSignPriceTextSurfaceDepth
                        : -outletProductSignPriceTextSurfaceDepth,
                ]}
                rotation={[0, isFront ? 0 : Math.PI, -0.02]}
                style={{
                    pointerEvents: 'none',
                }}
                zIndexRange={[4, 1]}
            >
                <span
                    aria-hidden="true"
                    className="flex h-[68px] w-[172px] items-center justify-center font-black leading-none whitespace-nowrap text-[#fff4ce]"
                    data-outlet-garden-product-sign-price-font-size={
                        priceFontSize
                    }
                    data-outlet-garden-product-sign-price-face={visibleFace}
                    data-outlet-garden-product-sign-price-label={
                        product.plantSortId
                    }
                    style={{
                        fontSize: `${priceFontSize.toString()}px`,
                        textShadow: '0 2px 2px rgb(55 24 14 / 70%)',
                        transform: `translate(-50%, calc(-50% + ${outletProductSignFaceCssOffsetY.toString()}px))`,
                    }}
                >
                    {product.priceLabel}
                </span>
            </Html>
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
                    <OutletGardenProductSignFaces
                        occlude={occlusionTargets ?? 'raycast'}
                        product={product}
                    />
                    <OutletGardenProductSignPriceTag product={product} />
                </group>
            ))}
        </group>
    );
}
