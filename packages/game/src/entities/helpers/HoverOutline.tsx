import { addAfterEffect, type RootState, useThree } from '@react-three/fiber';
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
    LinearFilter,
    type Material,
    Mesh,
    MeshBasicMaterial,
    NoBlending,
    type Object3D,
    OrthographicCamera,
    PlaneGeometry,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    type Texture,
    UnsignedByteType,
    Vector2,
    Vector3,
    WebGLRenderTarget,
} from 'three';

const hoverOutlineLayer = 29;
const maxOutlineThickness = 12;

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

function createOutlineMaterial() {
    return new ShaderMaterial({
        uniforms: {
            maskTexture: { value: null as Texture | null },
            outlineColor: { value: new Color('white') },
            opacity: { value: 1 },
            screenMax: { value: new Vector2(1, 1) },
            screenMin: { value: new Vector2(0, 0) },
            texelSize: { value: new Vector2(1, 1) },
            thickness: { value: 5 },
        },
        vertexShader: `
            uniform vec2 screenMax;
            uniform vec2 screenMin;

            varying vec2 vUv;

            void main() {
                vec2 clipMin = screenMin * 2.0 - 1.0;
                vec2 clipMax = screenMax * 2.0 - 1.0;

                vUv = mix(screenMin, screenMax, uv);
                gl_Position = vec4(mix(clipMin, clipMax, uv), 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D maskTexture;
            uniform vec3 outlineColor;
            uniform float opacity;
            uniform vec2 texelSize;
            uniform float thickness;

            varying vec2 vUv;

            void main() {
                float center = texture2D(maskTexture, vUv).r;
                float expanded = 0.0;

                for (int x = -${maxOutlineThickness}; x <= ${maxOutlineThickness}; x++) {
                    for (int y = -${maxOutlineThickness}; y <= ${maxOutlineThickness}; y++) {
                        vec2 offset = vec2(float(x), float(y));
                        if (dot(offset, offset) <= thickness * thickness) {
                            vec2 sampleUv = vUv + offset * texelSize;
                            if (
                                sampleUv.x >= 0.0 &&
                                sampleUv.x <= 1.0 &&
                                sampleUv.y >= 0.0 &&
                                sampleUv.y <= 1.0
                            ) {
                                expanded = max(
                                    expanded,
                                    texture2D(maskTexture, sampleUv).r
                                );
                            }
                        }
                    }
                }

                float alpha = expanded * (1.0 - center) * opacity;
                if (alpha < 0.01) {
                    discard;
                }

                gl_FragColor = vec4(outlineColor, alpha);
            }
        `,
        depthTest: false,
        depthWrite: false,
        transparent: true,
    });
}

type ScreenBounds = {
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
};

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

function getOutlineScreenBounds({
    camera,
    drawingBufferSize,
    scratch,
    targets,
    thickness,
}: {
    camera: Camera;
    drawingBufferSize: Vector2;
    scratch: ScreenBoundsScratch;
    targets: HoverOutlineTarget[];
    thickness: number;
}): ScreenBounds | null {
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

    const marginX = (thickness + 2) / drawingBufferSize.x;
    const marginY = (thickness + 2) / drawingBufferSize.y;
    const bounds = {
        maxX: Math.min(1, maxX + marginX),
        maxY: Math.min(1, maxY + marginY),
        minX: Math.max(0, minX - marginX),
        minY: Math.max(0, minY - marginY),
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

function resizeRenderTargetToDrawingBuffer(
    gl: RootState['gl'],
    renderTarget: WebGLRenderTarget,
    drawingBufferSize: Vector2,
) {
    gl.getDrawingBufferSize(drawingBufferSize);

    if (
        renderTarget.width !== drawingBufferSize.x ||
        renderTarget.height !== drawingBufferSize.y
    ) {
        renderTarget.setSize(drawingBufferSize.x, drawingBufferSize.y);
    }
}

function renderMask({
    camera,
    drawingBufferSize,
    gl,
    maskMaterial,
    renderTarget,
    scene,
    targets,
}: {
    camera: Camera;
    drawingBufferSize: Vector2;
    gl: RootState['gl'];
    maskMaterial: MeshBasicMaterial;
    renderTarget: WebGLRenderTarget;
    scene: Scene;
    targets: HoverOutlineTarget[];
}) {
    resizeRenderTargetToDrawingBuffer(gl, renderTarget, drawingBufferSize);

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
        gl.autoClear = true;
        gl.setRenderTarget(renderTarget);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);
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

function useOutlineOverlay() {
    const material = useMemo(createOutlineMaterial, []);

    const overlay = useMemo(() => {
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new PlaneGeometry(1, 1);
        const mesh = new Mesh(geometry, material);
        mesh.frustumCulled = false;
        scene.add(mesh);
        return { camera, geometry, scene };
    }, [material]);

    useEffect(
        () => () => {
            overlay.geometry.dispose();
            material.dispose();
        },
        [material, overlay],
    );

    return { ...overlay, material };
}

function useMaskRenderTarget() {
    const renderTarget = useMemo(
        () =>
            new WebGLRenderTarget(1, 1, {
                depthBuffer: false,
                format: RGBAFormat,
                magFilter: LinearFilter,
                minFilter: LinearFilter,
                stencilBuffer: false,
                type: UnsignedByteType,
            }),
        [],
    );

    useEffect(() => () => renderTarget.dispose(), [renderTarget]);

    return renderTarget;
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
    const invalidate = useThree((state) => state.invalidate);
    const maskMaterial = useMemo(createMaskMaterial, []);
    const maskRenderTarget = useMaskRenderTarget();
    const {
        camera: outlineCamera,
        material: outlineMaterial,
        scene: outlineScene,
    } = useOutlineOverlay();
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
    const wasActiveRef = useRef(false);

    useEffect(() => () => maskMaterial.dispose(), [maskMaterial]);

    useEffect(() => {
        if (!registry || !hasActiveTargets) {
            return;
        }

        const renderOutline = () => {
            const targets = registry.getActiveTargets();
            if (targets.length === 0) {
                return;
            }

            const targetsByStyle = new Map<string, HoverOutlineTarget[]>();
            for (const target of targets) {
                const key = [
                    target.priority,
                    target.color,
                    target.opacity,
                    target.thickness,
                ].join('|');
                targetsByStyle.set(key, [
                    ...(targetsByStyle.get(key) ?? []),
                    target,
                ]);
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

            for (const targetGroup of targetGroups) {
                const [firstTarget] = targetGroup;
                if (!firstTarget) {
                    continue;
                }

                renderMask({
                    camera,
                    drawingBufferSize,
                    gl,
                    maskMaterial,
                    renderTarget: maskRenderTarget,
                    scene,
                    targets: targetGroup,
                });

                outlineMaterial.uniforms.maskTexture.value =
                    maskRenderTarget.texture;
                outlineMaterial.uniforms.outlineColor.value.set(
                    firstTarget.color,
                );
                outlineMaterial.uniforms.opacity.value = firstTarget.opacity;
                const screenBounds = getOutlineScreenBounds({
                    camera,
                    drawingBufferSize,
                    scratch: screenBoundsScratch,
                    targets: targetGroup,
                    thickness: firstTarget.thickness,
                });

                if (!screenBounds) {
                    continue;
                }

                outlineMaterial.uniforms.screenMin.value.set(
                    screenBounds.minX,
                    screenBounds.minY,
                );
                outlineMaterial.uniforms.screenMax.value.set(
                    screenBounds.maxX,
                    screenBounds.maxY,
                );
                outlineMaterial.uniforms.texelSize.value.set(
                    1 / maskRenderTarget.width,
                    1 / maskRenderTarget.height,
                );
                outlineMaterial.uniforms.thickness.value =
                    firstTarget.thickness;

                const previousAutoClear = gl.autoClear;
                gl.autoClear = false;
                gl.render(outlineScene, outlineCamera);
                gl.autoClear = previousAutoClear;
            }
        };

        return addAfterEffect(renderOutline);
    }, [
        camera,
        drawingBufferSize,
        gl,
        hasActiveTargets,
        maskMaterial,
        maskRenderTarget,
        outlineCamera,
        outlineMaterial,
        outlineScene,
        registry,
        scene,
        screenBoundsScratch,
    ]);

    useEffect(() => {
        void registryVersion;
        if (wasActiveRef.current || hasActiveTargets) {
            invalidate();
        }
        wasActiveRef.current = hasActiveTargets;
    }, [hasActiveTargets, invalidate, registryVersion]);

    return null;
}
