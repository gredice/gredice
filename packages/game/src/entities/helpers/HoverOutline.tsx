import {
    addAfterEffect,
    type RootState,
    useFrame,
    useThree,
} from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import {
    Box3,
    type Camera,
    Color,
    DoubleSide,
    type Group,
    type Material,
    Mesh,
    MeshBasicMaterial,
    NearestFilter,
    NoBlending,
    type Object3D,
    OrthographicCamera,
    PlaneGeometry,
    RedFormat,
    Scene,
    ShaderMaterial,
    type Texture,
    UnsignedByteType,
    Vector2,
    Vector3,
    WebGLRenderTarget,
} from 'three';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import { useSceneRenderRequest } from '../../scene/SceneTime';
import { createHoverOutlineFrameGate } from './hoverOutlineFrameGate';
import {
    type HoverOutlineNormalizedBounds,
    type HoverOutlineRegion,
    resolveHoverOutlineRegion,
} from './hoverOutlineRegion';

const hoverOutlineLayer = 29;
const hoverOutlineFramePriority = -1_000;
const maxOutlineThickness = 12;
const unreachableSquaredDistance = 255;

type HoverOutlineTarget = {
    active: boolean;
    color: string;
    object: Object3D;
    opacity: number;
    priority: number;
    thickness: number;
};

type HoverOutlineRegistry = {
    deleteTarget: (id: symbol) => void;
    getActiveTargets: () => HoverOutlineTarget[];
    getSnapshot: () => number;
    setTarget: (id: symbol, target: HoverOutlineTarget) => void;
    subscribe: (listener: () => void) => () => void;
};

const HoverOutlineContext = createContext<HoverOutlineRegistry | null>(null);
const noopSubscribe = () => () => {};
const zeroSnapshot = () => 0;

function createMaskMaterial() {
    const material = new MeshBasicMaterial({
        blending: NoBlending,
        color: 'white',
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
    });
    material.fog = false;
    return material;
}

function createHorizontalDistanceMaterial() {
    return new ShaderMaterial({
        uniforms: {
            maskTexture: { value: null as Texture | null },
            cropSize: { value: new Vector2(1, 1) },
            radius: { value: 1 },
        },
        vertexShader: `
            void main() {
                gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D maskTexture;
            uniform vec2 cropSize;
            uniform float radius;

            void main() {
                ivec2 activeSize = ivec2(cropSize);
                ivec2 pixel = ivec2(gl_FragCoord.xy);
                float nearestDistanceSquared = ${unreachableSquaredDistance.toFixed(
                    1,
                )};

                for (int x = -${maxOutlineThickness}; x <= ${maxOutlineThickness}; x++) {
                    if (abs(float(x)) > radius) {
                        continue;
                    }

                    ivec2 candidate = pixel + ivec2(x, 0);
                    if (
                        candidate.x >= 0 &&
                        candidate.x < activeSize.x &&
                        candidate.y >= 0 &&
                        candidate.y < activeSize.y &&
                        texelFetch(maskTexture, candidate, 0).r > 0.5
                    ) {
                        nearestDistanceSquared = min(
                            nearestDistanceSquared,
                            float(x * x)
                        );
                    }
                }

                gl_FragColor = vec4(
                    nearestDistanceSquared / ${unreachableSquaredDistance.toFixed(
                        1,
                    )},
                    0.0,
                    0.0,
                    1.0
                );
            }
        `,
        blending: NoBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
    });
}

function createOutlineMaterial() {
    return new ShaderMaterial({
        uniforms: {
            cropMin: { value: new Vector2(0, 0) },
            cropSize: { value: new Vector2(1, 1) },
            horizontalDistanceTexture: { value: null as Texture | null },
            maskTexture: { value: null as Texture | null },
            outlineColor: { value: new Color('white') },
            opacity: { value: 1 },
            radius: { value: 1 },
            screenMax: { value: new Vector2(1, 1) },
            screenMin: { value: new Vector2(0, 0) },
            thickness: { value: 5 },
        },
        vertexShader: `
            uniform vec2 screenMax;
            uniform vec2 screenMin;

            void main() {
                vec2 clipMin = screenMin * 2.0 - 1.0;
                vec2 clipMax = screenMax * 2.0 - 1.0;

                gl_Position = vec4(mix(clipMin, clipMax, uv), 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec2 cropMin;
            uniform vec2 cropSize;
            uniform sampler2D horizontalDistanceTexture;
            uniform sampler2D maskTexture;
            uniform vec3 outlineColor;
            uniform float opacity;
            uniform float radius;
            uniform float thickness;

            void main() {
                ivec2 activeSize = ivec2(cropSize);
                ivec2 pixel = ivec2(gl_FragCoord.xy) - ivec2(cropMin);
                float center = texelFetch(maskTexture, pixel, 0).r;
                float nearestDistanceSquared = ${unreachableSquaredDistance.toFixed(
                    1,
                )};

                for (int y = -${maxOutlineThickness}; y <= ${maxOutlineThickness}; y++) {
                    if (abs(float(y)) > radius) {
                        continue;
                    }

                    ivec2 candidate = pixel + ivec2(0, y);
                    if (
                        candidate.x >= 0 &&
                        candidate.x < activeSize.x &&
                        candidate.y >= 0 &&
                        candidate.y < activeSize.y
                    ) {
                        float horizontalDistanceSquared = floor(
                            texelFetch(
                                horizontalDistanceTexture,
                                candidate,
                                0
                            ).r * ${unreachableSquaredDistance.toFixed(1)} + 0.5
                        );
                        nearestDistanceSquared = min(
                            nearestDistanceSquared,
                            horizontalDistanceSquared + float(y * y)
                        );
                    }
                }

                float expanded =
                    nearestDistanceSquared <= thickness * thickness ? 1.0 : 0.0;
                float alpha = expanded * (1.0 - center) * opacity;
                if (alpha < 0.01) {
                    discard;
                }

                gl_FragColor = vec4(outlineColor, alpha);
            }
        `,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        transparent: true,
    });
}

type ScreenBoundsScratch = {
    box: Box3;
    point: Vector3;
};

type ObjectWithMaterial = Object3D & {
    material: Material | Material[] | null | undefined;
};

function hasMaterial(object: Object3D): object is ObjectWithMaterial {
    return 'material' in object;
}

function getObjectMaterials(object: Object3D) {
    if (!hasMaterial(object)) {
        return [];
    }

    if (!object.material) {
        return [];
    }

    return Array.isArray(object.material) ? object.material : [object.material];
}

function getOutlineNormalizedBounds({
    camera,
    scratch,
    targets,
}: {
    camera: Camera;
    scratch: ScreenBoundsScratch;
    targets: HoverOutlineTarget[];
}): HoverOutlineNormalizedBounds | null {
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;

    for (const target of targets) {
        scratch.box.setFromObject(target.object);

        if (scratch.box.isEmpty()) {
            continue;
        }

        const { max, min } = scratch.box;

        for (let xIndex = 0; xIndex < 2; xIndex++) {
            for (let yIndex = 0; yIndex < 2; yIndex++) {
                for (let zIndex = 0; zIndex < 2; zIndex++) {
                    scratch.point
                        .set(
                            xIndex === 0 ? min.x : max.x,
                            yIndex === 0 ? min.y : max.y,
                            zIndex === 0 ? min.z : max.z,
                        )
                        .project(camera);

                    if (
                        !Number.isFinite(scratch.point.x) ||
                        !Number.isFinite(scratch.point.y)
                    ) {
                        continue;
                    }

                    const x = scratch.point.x * 0.5 + 0.5;
                    const y = scratch.point.y * 0.5 + 0.5;

                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                }
            }
        }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null;
    }

    const bounds = {
        maxX,
        maxY,
        minX,
        minY,
    };

    if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
        return null;
    }

    return bounds;
}

function useHoverOutlineRegistry() {
    const listeners = useRef(new Set<() => void>());
    const targets = useRef(new Map<symbol, HoverOutlineTarget>());
    const version = useRef(0);

    return useMemo<HoverOutlineRegistry>(() => {
        const notify = () => {
            version.current += 1;
            for (const listener of listeners.current) {
                listener();
            }
        };

        return {
            deleteTarget: (id) => {
                if (!targets.current.delete(id)) {
                    return;
                }
                notify();
            },
            getActiveTargets: () =>
                Array.from(targets.current.values()).filter(
                    (target) => target.active && target.object.parent,
                ),
            getSnapshot: () => version.current,
            setTarget: (id, target) => {
                targets.current.set(id, target);
                notify();
            },
            subscribe: (listener) => {
                listeners.current.add(listener);
                return () => listeners.current.delete(listener);
            },
        };
    }, []);
}

function useTargetId() {
    const id = useRef<symbol>(Symbol('hover-outline-target'));
    return id.current;
}

function setLayerMask(objects: Object3D[], layer: number) {
    const previousLayers: [object: Object3D, mask: number][] = [];
    const previousMaterialVisibility: [material: Material, visible: boolean][] =
        [];

    for (const object of objects) {
        object.traverse((child) => {
            previousLayers.push([child, child.layers.mask]);
            child.layers.set(layer);
            for (const material of getObjectMaterials(child)) {
                if (!material.visible) {
                    previousMaterialVisibility.push([
                        material,
                        material.visible,
                    ]);
                    material.visible = true;
                }
            }
        });
    }

    return () => {
        for (const [material, visible] of previousMaterialVisibility) {
            material.visible = visible;
        }
        for (const [object, mask] of previousLayers) {
            object.layers.mask = mask;
        }
    };
}

function renderMask({
    camera,
    gl,
    maskMaterial,
    region,
    renderTarget,
    scene,
    targets,
}: {
    camera: Camera;
    gl: RootState['gl'];
    maskMaterial: MeshBasicMaterial;
    region: HoverOutlineRegion;
    renderTarget: WebGLRenderTarget;
    scene: Scene;
    targets: HoverOutlineTarget[];
}) {
    const restoreLayers = setLayerMask(
        targets.map((target) => target.object),
        hoverOutlineLayer,
    );
    const previousCameraLayers = camera.layers.mask;
    const previousOverrideMaterial = scene.overrideMaterial;
    const previousBackground = scene.background;
    const previousRenderTarget = gl.getRenderTarget();
    const previousClearAlpha = gl.getClearAlpha();
    const previousAutoClear = gl.autoClear;
    const previousClearColor = gl.getClearColor(new Color());

    try {
        camera.layers.set(hoverOutlineLayer);
        scene.background = null;
        scene.overrideMaterial = maskMaterial;
        gl.autoClear = false;
        renderTarget.viewport.set(
            -region.crop.x,
            -region.crop.y,
            region.drawingBuffer.width,
            region.drawingBuffer.height,
        );
        renderTarget.scissor.set(0, 0, region.crop.width, region.crop.height);
        renderTarget.scissorTest = true;
        gl.setRenderTarget(renderTarget);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, false, false);
        gl.render(scene, camera);
    } finally {
        restoreLayers();
        camera.layers.mask = previousCameraLayers;
        scene.background = previousBackground;
        scene.overrideMaterial = previousOverrideMaterial;
        gl.setRenderTarget(previousRenderTarget);
        gl.setClearColor(previousClearColor, previousClearAlpha);
        gl.autoClear = previousAutoClear;
    }
}

function renderHorizontalDistance({
    camera,
    gl,
    material,
    mesh,
    region,
    renderTarget,
    scene,
}: {
    camera: OrthographicCamera;
    gl: RootState['gl'];
    material: ShaderMaterial;
    mesh: Mesh;
    region: HoverOutlineRegion;
    renderTarget: WebGLRenderTarget;
    scene: Scene;
}) {
    const previousAutoClear = gl.autoClear;
    const previousMaterial = mesh.material;
    const previousRenderTarget = gl.getRenderTarget();

    try {
        gl.autoClear = false;
        mesh.material = material;
        renderTarget.viewport.set(0, 0, region.crop.width, region.crop.height);
        renderTarget.scissor.set(0, 0, region.crop.width, region.crop.height);
        renderTarget.scissorTest = true;
        gl.setRenderTarget(renderTarget);
        gl.render(scene, camera);
    } finally {
        mesh.material = previousMaterial;
        gl.setRenderTarget(previousRenderTarget);
        gl.autoClear = previousAutoClear;
    }
}

function renderOutlineComposite({
    camera,
    gl,
    material,
    mesh,
    scene,
}: {
    camera: OrthographicCamera;
    gl: RootState['gl'];
    material: ShaderMaterial;
    mesh: Mesh;
    scene: Scene;
}) {
    const previousAutoClear = gl.autoClear;
    const previousMaterial = mesh.material;

    try {
        gl.autoClear = false;
        mesh.material = material;
        gl.render(scene, camera);
    } finally {
        mesh.material = previousMaterial;
        gl.autoClear = previousAutoClear;
    }
}

function useOutlinePipeline() {
    const horizontalDistanceMaterial = useMemo(
        createHorizontalDistanceMaterial,
        [],
    );
    const outlineMaterial = useMemo(createOutlineMaterial, []);

    const overlay = useMemo(() => {
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new PlaneGeometry(1, 1);
        const mesh = new Mesh(geometry, outlineMaterial);
        mesh.frustumCulled = false;
        scene.add(mesh);
        return { camera, geometry, mesh, scene };
    }, [outlineMaterial]);

    useEffect(
        () => () => {
            overlay.geometry.dispose();
            horizontalDistanceMaterial.dispose();
            outlineMaterial.dispose();
        },
        [horizontalDistanceMaterial, outlineMaterial, overlay],
    );

    return {
        ...overlay,
        horizontalDistanceMaterial,
        outlineMaterial,
    };
}

function createOutlineRenderTarget(name: string) {
    const renderTarget = new WebGLRenderTarget(1, 1, {
        depthBuffer: false,
        format: RedFormat,
        magFilter: NearestFilter,
        minFilter: NearestFilter,
        stencilBuffer: false,
        type: UnsignedByteType,
    });
    renderTarget.texture.name = name;
    renderTarget.texture.generateMipmaps = false;
    return renderTarget;
}

function useOutlineRenderTargets() {
    const renderTargets = useMemo(
        () => ({
            horizontalDistance: createOutlineRenderTarget(
                'HoverOutline.HorizontalDistance',
            ),
            mask: createOutlineRenderTarget('HoverOutline.Mask'),
        }),
        [],
    );

    useEffect(
        () => () => {
            renderTargets.horizontalDistance.dispose();
            renderTargets.mask.dispose();
        },
        [renderTargets],
    );

    return renderTargets;
}

export function HoverOutlineProvider({ children }: PropsWithChildren) {
    const registry = useHoverOutlineRegistry();

    return (
        <HoverOutlineContext.Provider value={registry}>
            {children}
        </HoverOutlineContext.Provider>
    );
}

type HoverOutlineProps = PropsWithChildren<{
    color?: string;
    hovered?: boolean;
    opacity?: number;
    priority?: number;
    thickness?: number;
}>;

export function HoverOutline({
    children,
    color = 'white',
    hovered = false,
    opacity = 1,
    priority = 0,
    thickness = 5,
}: HoverOutlineProps) {
    const ref = useRef<Group>(null);
    const registry = useContext(HoverOutlineContext);
    const id = useTargetId();
    const clampedThickness = Math.min(
        Math.max(thickness, 1),
        maxOutlineThickness,
    );

    useLayoutEffect(() => {
        if (!registry || !ref.current) {
            return;
        }

        registry.setTarget(id, {
            active: hovered,
            color,
            object: ref.current,
            opacity,
            priority,
            thickness: clampedThickness,
        });

        return () => registry.deleteTarget(id);
    }, [clampedThickness, color, hovered, id, opacity, priority, registry]);

    return (
        <group ref={ref} name="Interaction:HoverOutlineTarget">
            {children}
        </group>
    );
}

export function HoverOutlineEffect() {
    const registry = useContext(HoverOutlineContext);
    const camera = useThree((state) => state.camera);
    const drawingBufferSize = useMemo(() => new Vector2(), []);
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const maskMaterial = useMemo(createMaskMaterial, []);
    const renderTargets = useOutlineRenderTargets();
    const {
        camera: outlineCamera,
        horizontalDistanceMaterial,
        mesh: outlineMesh,
        outlineMaterial,
        scene: outlineScene,
    } = useOutlinePipeline();
    const scene = useThree((state) => state.scene);
    const screenBoundsScratch = useMemo<ScreenBoundsScratch>(
        () => ({ box: new Box3(), point: new Vector3() }),
        [],
    );
    const registryVersion = useSyncExternalStore(
        registry?.subscribe ?? noopSubscribe,
        registry?.getSnapshot ?? zeroSnapshot,
        zeroSnapshot,
    );
    const hasActiveTargets = (registry?.getActiveTargets().length ?? 0) > 0;
    const frameGate = useMemo(createHoverOutlineFrameGate, []);
    const passCountsRef = useRef({
        composite: 0,
        horizontal: 0,
        mask: 0,
    });
    const publishProfileMetadata =
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/debug/profile/game');
    const wasActiveRef = useRef(false);

    useFrame(frameGate.markRenderedFrame, hoverOutlineFramePriority);

    useEffect(() => () => maskMaterial.dispose(), [maskMaterial]);

    useEffect(() => {
        if (!registry || !hasActiveTargets) {
            return;
        }

        const frameConsumer = frameGate.registerConsumer();

        const renderOutline = () => {
            if (!frameConsumer.consumeRenderedFrame()) {
                return;
            }

            const targets = registry.getActiveTargets();
            if (targets.length === 0) {
                return;
            }
            gl.getDrawingBufferSize(drawingBufferSize);

            const targetsByStyle = new Map<string, HoverOutlineTarget[]>();
            for (const target of targets) {
                const key = [
                    target.priority,
                    target.color,
                    target.opacity,
                    target.thickness,
                ].join('|');
                const targetGroup = targetsByStyle.get(key);
                if (targetGroup) {
                    targetGroup.push(target);
                } else {
                    targetsByStyle.set(key, [target]);
                }
            }

            const targetGroups = Array.from(targetsByStyle.values()).sort(
                (left, right) => {
                    const leftTarget = left[0];
                    const rightTarget = right[0];
                    return (
                        (leftTarget?.priority ?? 0) -
                        (rightTarget?.priority ?? 0)
                    );
                },
            );

            const preparedGroups: {
                firstTarget: HoverOutlineTarget;
                region: HoverOutlineRegion;
                targets: HoverOutlineTarget[];
            }[] = [];
            for (const targetGroup of targetGroups) {
                const [firstTarget] = targetGroup;
                if (!firstTarget) {
                    continue;
                }
                const normalizedBounds = getOutlineNormalizedBounds({
                    camera,
                    scratch: screenBoundsScratch,
                    targets: targetGroup,
                });
                if (!normalizedBounds) {
                    continue;
                }
                const region = resolveHoverOutlineRegion({
                    bounds: normalizedBounds,
                    drawingBufferHeight: drawingBufferSize.y,
                    drawingBufferWidth: drawingBufferSize.x,
                    thickness: firstTarget.thickness,
                });
                if (!region) {
                    continue;
                }
                preparedGroups.push({
                    firstTarget,
                    region,
                    targets: targetGroup,
                });
            }

            if (preparedGroups.length === 0) {
                if (publishProfileMetadata) {
                    updateGameProfileMetadata({
                        hoverOutlineActiveTargetCount: 0,
                        hoverOutlineCropClippedCount: 0,
                        hoverOutlineCropPixelCount: 0,
                        hoverOutlineDrawingBufferPixelCount:
                            drawingBufferSize.x * drawingBufferSize.y,
                        hoverOutlineRoiRatio: 0,
                        hoverOutlineStyleGroupCount: 0,
                        hoverOutlineThickness: 0,
                    });
                }
                return;
            }

            const allocationWidth = Math.max(
                ...preparedGroups.map(
                    ({ region }) => region.allocationCapacity.width,
                ),
            );
            const allocationHeight = Math.max(
                ...preparedGroups.map(
                    ({ region }) => region.allocationCapacity.height,
                ),
            );
            for (const renderTarget of [
                renderTargets.mask,
                renderTargets.horizontalDistance,
            ]) {
                if (
                    renderTarget.width !== allocationWidth ||
                    renderTarget.height !== allocationHeight
                ) {
                    renderTarget.setSize(allocationWidth, allocationHeight);
                }
            }

            let cropClippedCount = 0;
            let cropPixelCount = 0;
            let kernelSampleCount = 0;
            let maximumThickness = 0;
            let renderedTargetCount = 0;
            for (const {
                firstTarget,
                region,
                targets: targetGroup,
            } of preparedGroups) {
                const radius = Math.ceil(firstTarget.thickness);

                renderMask({
                    camera,
                    gl,
                    maskMaterial,
                    region,
                    renderTarget: renderTargets.mask,
                    scene,
                    targets: targetGroup,
                });
                passCountsRef.current.mask += 1;

                horizontalDistanceMaterial.uniforms.maskTexture.value =
                    renderTargets.mask.texture;
                horizontalDistanceMaterial.uniforms.cropSize.value.set(
                    region.crop.width,
                    region.crop.height,
                );
                horizontalDistanceMaterial.uniforms.radius.value = radius;
                renderHorizontalDistance({
                    camera: outlineCamera,
                    gl,
                    material: horizontalDistanceMaterial,
                    mesh: outlineMesh,
                    region,
                    renderTarget: renderTargets.horizontalDistance,
                    scene: outlineScene,
                });
                passCountsRef.current.horizontal += 1;

                outlineMaterial.uniforms.maskTexture.value =
                    renderTargets.mask.texture;
                outlineMaterial.uniforms.horizontalDistanceTexture.value =
                    renderTargets.horizontalDistance.texture;
                outlineMaterial.uniforms.outlineColor.value.set(
                    firstTarget.color,
                );
                outlineMaterial.uniforms.opacity.value = firstTarget.opacity;
                outlineMaterial.uniforms.cropMin.value.set(
                    region.crop.x,
                    region.crop.y,
                );
                outlineMaterial.uniforms.cropSize.value.set(
                    region.crop.width,
                    region.crop.height,
                );
                outlineMaterial.uniforms.radius.value = radius;
                outlineMaterial.uniforms.screenMin.value.set(
                    region.crop.x / region.drawingBuffer.width,
                    region.crop.y / region.drawingBuffer.height,
                );
                outlineMaterial.uniforms.screenMax.value.set(
                    region.crop.maxX / region.drawingBuffer.width,
                    region.crop.maxY / region.drawingBuffer.height,
                );
                outlineMaterial.uniforms.thickness.value =
                    firstTarget.thickness;
                renderOutlineComposite({
                    camera: outlineCamera,
                    gl,
                    material: outlineMaterial,
                    mesh: outlineMesh,
                    scene: outlineScene,
                });
                passCountsRef.current.composite += 1;

                cropClippedCount += region.clipping.any ? 1 : 0;
                cropPixelCount += region.crop.width * region.crop.height;
                kernelSampleCount = Math.max(kernelSampleCount, radius * 4 + 3);
                maximumThickness = Math.max(
                    maximumThickness,
                    firstTarget.thickness,
                );
                renderedTargetCount += targetGroup.length;
            }

            const drawingBufferPixelCount =
                drawingBufferSize.x * drawingBufferSize.y;
            const allocatedPixelCount = allocationWidth * allocationHeight;
            if (publishProfileMetadata) {
                updateGameProfileMetadata({
                    hoverOutlineActiveTargetCount: renderedTargetCount,
                    hoverOutlineAllocatedHeight: allocationHeight,
                    hoverOutlineAllocatedPixelCount: allocatedPixelCount,
                    hoverOutlineAllocatedWidth: allocationWidth,
                    hoverOutlineAllocationEstimatedBytes:
                        allocatedPixelCount * 2,
                    hoverOutlineCompositePassCount:
                        passCountsRef.current.composite,
                    hoverOutlineCropClippedCount: cropClippedCount,
                    hoverOutlineCropPixelCount: cropPixelCount,
                    hoverOutlineDrawingBufferPixelCount:
                        drawingBufferPixelCount,
                    hoverOutlineFormat: 'r8',
                    hoverOutlineHorizontalPassCount:
                        passCountsRef.current.horizontal,
                    hoverOutlineKernelSampleCount: kernelSampleCount,
                    hoverOutlineMaskPassCount: passCountsRef.current.mask,
                    hoverOutlineMaxKernelSampleCount:
                        maxOutlineThickness * 4 + 3,
                    hoverOutlinePipeline: 'cropped-bounded-separable-r8',
                    hoverOutlineRenderTargetCount: 2,
                    hoverOutlineRoiRatio:
                        cropPixelCount / drawingBufferPixelCount,
                    hoverOutlineStyleGroupCount: preparedGroups.length,
                    hoverOutlineThickness: maximumThickness,
                });
            }
        };

        const removeAfterEffect = addAfterEffect(renderOutline);
        return () => {
            removeAfterEffect();
            frameConsumer.release();
        };
    }, [
        camera,
        drawingBufferSize,
        frameGate,
        gl,
        hasActiveTargets,
        horizontalDistanceMaterial,
        maskMaterial,
        outlineCamera,
        outlineMaterial,
        outlineMesh,
        outlineScene,
        publishProfileMetadata,
        renderTargets,
        registry,
        scene,
        screenBoundsScratch,
    ]);

    useEffect(() => {
        void registryVersion;
        if (wasActiveRef.current || hasActiveTargets) {
            requestRender('hover-outline-targets');
        }
        if (!hasActiveTargets && publishProfileMetadata) {
            updateGameProfileMetadata({
                hoverOutlineActiveTargetCount: 0,
                hoverOutlineCropClippedCount: 0,
                hoverOutlineCropPixelCount: 0,
                hoverOutlineRoiRatio: 0,
                hoverOutlineStyleGroupCount: 0,
                hoverOutlineThickness: 0,
            });
        }
        wasActiveRef.current = hasActiveTargets;
    }, [
        hasActiveTargets,
        publishProfileMetadata,
        registryVersion,
        requestRender,
    ]);

    return null;
}
