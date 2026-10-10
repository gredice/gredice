import {
    ACESFilmicToneMapping,
    DirectionalLight,
    HemisphereLight,
    InstancedMesh,
    Matrix4,
    Mesh,
    OrthographicCamera,
    PCFShadowMap,
    Quaternion,
    Scene,
    SRGBColorSpace,
    Vector3,
    WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BundleGroup, WebGPURenderer } from 'three/webgpu';
import {
    compileMeshBuffers,
    packMeshGeometry,
    unpackMeshGeometry,
} from '../../src/scene/compiler/meshBuffers';
import { benchmarkCPU, distribution } from './cpu.mjs';

const params = new URLSearchParams(location.search);
const backend = params.get('backend') ?? 'webgl';
const mobile = params.get('device') === 'iphone14';
const side = Number(params.get('side') ?? 16);
const dpr = Number(params.get('dpr') ?? (mobile ? 3 : 1));
const shadows = params.get('shadows') !== '0';
const layout = params.get('layout') ?? 'batched';
// Match Playwright's portrait iPhone 14 browser viewport, excluding Safari chrome.
const width = mobile ? 390 : 960;
const height = mobile ? 664 : 640;
const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const nextFrame = () => new Promise(requestAnimationFrame);
document.body.dataset.device = mobile ? 'iphone14' : 'desktop';
document.body.dataset.automation = String(params.has('automation'));
for (const link of document.querySelectorAll('nav a')) {
    const destination = new URL(link.href);
    const query = new URLSearchParams(params);
    query.delete('automation');
    for (const [key, value] of destination.searchParams) query.set(key, value);
    if (destination.searchParams.has('device')) query.delete('dpr');
    link.href = `?${query}`;
}
document.querySelector('#device-note').textContent = mobile
    ? `iPhone 14 viewport · 390×664 CSS pixels · render scale ${dpr}×. Desktop preview; CPU throttling applies only in the benchmark runner.`
    : 'Desktop viewport · 960×640 CSS pixels.';

async function main() {
    if (backend === 'webgpu-bundle' && shadows) {
        throw new Error(
            'This BundleGroup POC supports shadows=0 only. The shadowed camera-motion probe failed visual parity; see the investigation.',
        );
    }
    const start = performance.now();
    const renderer =
        backend === 'webgl'
            ? new WebGLRenderer({
                  canvas,
                  antialias: false,
                  alpha: true,
                  powerPreference: 'high-performance',
              })
            : new WebGPURenderer({
                  canvas,
                  antialias: false,
                  alpha: true,
                  forceWebGL: backend === 'webgpu-gl',
                  trackTimestamp: true,
              });
    if (backend !== 'webgl') await renderer.init();
    // A silent fallback invalidates a WebGPU comparison.
    if (
        backend.startsWith('webgpu') &&
        backend !== 'webgpu-gl' &&
        !renderer.backend.isWebGPUBackend
    )
        throw new Error('WebGPU unavailable: refusing fallback measurement');
    // Request timestamp capability at init, but do not record GPU queries in the
    // CPU/FPS pass. Both renderers get the same uninstrumented primary workload.
    const gpuTimestampSupported =
        backend !== 'webgl' && renderer.backend.trackTimestamp;
    if (backend !== 'webgl') renderer.backend.trackTimestamp = false;
    const rendererInitMs = performance.now() - start;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    canvas.style.width = `${width}px`;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.info.autoReset = false;
    const scene = new Scene();
    const renderGroup = backend === 'webgpu-bundle' ? new BundleGroup() : scene;
    if (renderGroup !== scene) scene.add(renderGroup);
    // CSS background avoids backend-specific tone mapping of Scene.background.
    canvas.style.background = '#bfd8c5';
    const camera = new OrthographicCamera(
        -side * 0.77,
        side * 0.77,
        (side * 0.77 * height) / width,
        (-side * 0.77 * height) / width,
        0.1,
        side * 8,
    );
    const target = new Vector3(0, 0.4, 0);
    let yaw = Math.PI / 4;
    const updateCamera = (angle) => {
        camera.position.set(
            Math.cos(angle) * side * 1.6,
            side * 1.45,
            Math.sin(angle) * side * 1.6,
        );
        camera.lookAt(target);
        camera.updateMatrixWorld();
    };
    updateCamera(yaw);
    scene.add(new HemisphereLight(0xe4f2ff, 0x7b7359, 2));
    const sun = new DirectionalLight(0xfff0d5, 3);
    sun.position.set(side * 0.6, side * 1.2, side * 0.3);
    sun.castShadow = shadows;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
        left: -side,
        right: side,
        top: side,
        bottom: -side,
        near: 0.1,
        far: side * 5,
    });
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const loader = new GLTFLoader();
    const assets = Object.fromEntries(
        await Promise.all(
            ['BlockGrass', 'Tree', 'GardenBox'].map(async (name) => [
                name,
                await loader.loadAsync(`/assets/${name}.glb`),
            ]),
        ),
    );
    const find = (asset, name) => {
        const node = assets[asset].scene.getObjectByName(name);
        if (!node?.isMesh) throw new Error(`Missing ${asset}/${name}`);
        return node;
    };
    const grass = find('BlockGrass', 'Block_Grass_1_2');
    const batches = new Map();
    const add = (asset, name, x, y, z, scale = [1, 1, 1]) => {
        const key = `${asset}/${name}/${Math.floor(x / 8)}/${Math.floor(z / 8)}`;
        let batch = batches.get(key);
        if (!batch) {
            batch = {
                source: find(asset, name),
                matrices: [],
                terrain: asset === 'BlockGrass',
            };
            batches.set(key, batch);
        }
        const matrix = new Matrix4().compose(
            new Vector3(x - (side - 1) / 2, y, z - (side - 1) / 2),
            new Quaternion(),
            new Vector3(...scale),
        );
        batch.matrices.push(matrix);
    };
    let trees = 0;
    let boxes = 0;
    for (let z = 0; z < side; z++)
        for (let x = 0; x < side; x++) {
            add('BlockGrass', 'Block_Grass_1_2', x, 0.2, z);
            if (x % 4 === 1 && z % 4 === 1) {
                trees++;
                for (const part of ['Tree_1_1', 'Tree_1_2', 'Tree_1_3'])
                    add('Tree', part, x, 0.9, z, [0.125, 0.5, 0.125]);
            } else if (x % 4 === 3 && z % 4 === 3) {
                boxes++;
                add('GardenBox', 'GardenBox_Body_Planks', x, 0.4, z);
            }
        }
    const sceneObjects = [];
    for (const batch of batches.values()) {
        let meshes;
        if (layout === 'individual') {
            meshes = batch.matrices.map((matrix) => {
                const mesh = new Mesh(
                    batch.source.geometry,
                    batch.source.material,
                );
                mesh.applyMatrix4(matrix);
                return mesh;
            });
        } else if (batch.terrain) {
            // Reuse the production retained-chunk buffer compiler.
            const packed = packMeshGeometry(batch.source.geometry);
            const matrices = new Float64Array(
                batch.matrices.flatMap((matrix) => matrix.elements),
            );
            meshes = [
                new Mesh(
                    unpackMeshGeometry(compileMeshBuffers(packed, matrices)),
                    batch.source.material,
                ),
            ];
        } else {
            const mesh = new InstancedMesh(
                batch.source.geometry,
                batch.source.material,
                batch.matrices.length,
            );
            batch.matrices.forEach((matrix, i) => {
                mesh.setMatrixAt(i, matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            meshes = [mesh];
        }
        for (const mesh of meshes) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // Disable backend-dependent culling for identical submitted geometry.
            mesh.frustumCulled = false;
            mesh.matrixAutoUpdate = false;
            renderGroup.add(mesh);
            sceneObjects.push(mesh);
        }
    }
    const render = () => {
        renderer.info.reset();
        renderer.render(scene, camera);
    };
    await renderer.compileAsync(scene, camera);
    render();
    const readyMs = performance.now() - start;
    const gl =
        backend === 'webgl' ? renderer.getContext() : renderer.backend.gl;
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const adapterInfo = renderer.backend?.device?.adapterInfo;
    const meta = {
        backend,
        actualBackend:
            backend === 'webgl'
                ? 'WebGL2'
                : renderer.backend.isWebGPUBackend
                  ? 'WebGPU'
                  : 'WebGL2',
        side,
        dpr,
        shadows,
        layout,
        width,
        height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        devicePreset: mobile ? 'iPhone 14' : null,
        viewport: { width: innerWidth, height: innerHeight },
        screen: { width: screen.width, height: screen.height },
        maxTouchPoints: navigator.maxTouchPoints,
        trees,
        boxes,
        terrainCells: side * side,
        objects: sceneObjects.length,
        sceneTriangles: sceneObjects.reduce(
            (total, mesh) =>
                total +
                ((mesh.geometry.index?.count ??
                    mesh.geometry.attributes.position.count) /
                    3) *
                    (mesh.isInstancedMesh ? mesh.count : 1),
            0,
        ),
        // Renderer._renderOutput uses one fullscreen triangle for color conversion.
        outputPassTriangles: backend === 'webgl' ? 0 : 1,
        rendererInitMs,
        readyMs,
        userAgent: navigator.userAgent,
        reportedDpr: devicePixelRatio,
        crossOriginIsolated,
        gpuTimestampSupported,
        glRenderer: debug
            ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
            : null,
        adapter: adapterInfo
            ? {
                  vendor: adapterInfo.vendor,
                  architecture: adapterInfo.architecture,
                  device: adapterInfo.device,
                  description: adapterInfo.description,
              }
            : null,
    };
    // Keep the original fixture's continuous preview. In desktop WebKit an
    // idle WebGPU canvas can produce blank automated captures; the benchmark
    // owns its own frame loop and never runs this preview loop.
    let preview = !params.has('automation');
    async function previewLoop() {
        while (preview) {
            await nextFrame();
            if (preview) render();
        }
    }
    void previewLoop();
    const pointers = new Map();
    const pinchDistance = () => {
        const [a, b] = pointers.values();
        return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const zoom = (factor) => {
        camera.zoom = Math.max(0.6, Math.min(2, camera.zoom * factor));
        camera.updateProjectionMatrix();
        render();
    };
    canvas.addEventListener('pointerdown', (e) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        canvas.setPointerCapture(e.pointerId);
    });
    const release = (e) => pointers.delete(e.pointerId);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('pointermove', (e) => {
        const previous = pointers.get(e.pointerId);
        if (!previous) return;
        const distance = pinchDistance();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
            yaw += (e.clientX - previous.x) * 0.005;
            updateCamera(yaw);
            render();
        } else if (distance > 0) {
            zoom(pinchDistance() / distance);
        }
    });
    canvas.addEventListener(
        'wheel',
        (e) => {
            e.preventDefault();
            zoom(Math.exp(-e.deltaY * 0.001));
        },
        { passive: false },
    );

    async function sample({ warmup = 90, frames = 240, motion = true } = {}) {
        preview = false;
        const cpu = [],
            intervals = [],
            draws = [],
            triangles = [],
            longTasks = [];
        const observer = new PerformanceObserver((list) => {
            for (const item of list.getEntries()) longTasks.push(item.duration);
        });
        const update = (i) => {
            if (motion) updateCamera(Math.PI / 4 + Math.sin(i / 75) * 0.18);
        };
        for (let i = 0; i < warmup; i++) {
            await nextFrame();
            update(i);
            render();
        }
        observer.observe({ type: 'longtask' });
        let previous = await nextFrame();
        const start = performance.now();
        for (let i = 0; i < frames; i++) {
            const now = await nextFrame();
            intervals.push(now - previous);
            previous = now;
            update(i);
            const begin = performance.now();
            render();
            cpu.push(performance.now() - begin);
            draws.push(
                backend === 'webgl'
                    ? renderer.info.render.calls
                    : renderer.info.render.drawCalls,
            );
            triangles.push(renderer.info.render.triangles);
        }
        const elapsed = performance.now() - start;
        observer.disconnect();
        // GPU timestamps are deliberately sampled separately: awaiting readback must
        // not contaminate the primary frame-delivery / CPU submission measurement.
        const gpu = [];
        if (backend !== 'webgl')
            renderer.backend.trackTimestamp = gpuTimestampSupported;
        const ext = gl?.getExtension('EXT_disjoint_timer_query_webgl2');
        for (let i = 0; i < 40; i++) {
            await nextFrame();
            update(i);
            if (backend === 'webgl' && ext) {
                const query = gl.createQuery();
                gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
                render();
                gl.endQuery(ext.TIME_ELAPSED_EXT);
                let attempts = 0;
                while (
                    !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) &&
                    attempts++ < 120
                )
                    await nextFrame();
                if (
                    gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) &&
                    !gl.getParameter(ext.GPU_DISJOINT_EXT)
                )
                    gpu.push(
                        gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6,
                    );
                gl.deleteQuery(query);
            } else if (backend !== 'webgl' && gpuTimestampSupported) {
                render();
                const time = await renderer.resolveTimestampsAsync();
                if (Number.isFinite(time) && time > 0) gpu.push(time);
            } else render();
        }
        updateCamera(Math.PI / 4);
        render();
        return {
            meta,
            elapsedMs: elapsed,
            deliveredFps: (frames * 1000) / elapsed,
            cpuMs: distribution(cpu),
            frameMs: distribution(intervals),
            gpuMs: distribution(gpu),
            draws: distribution(draws),
            triangles: distribution(triangles),
            longTasks,
            raw: { cpu, intervals, gpu },
            heapBytes: performance.memory?.usedJSHeapSize ?? null,
        };
    }
    window.engineMigration = {
        meta,
        sample,
        pose: (angle) => {
            updateCamera(angle);
            render();
        },
        cpu: () => benchmarkCPU(grass.geometry),
    };
    status.textContent = `${meta.actualBackend} · ${side * side} cells · ${trees} trees · ${canvas.width}×${canvas.height} · ${layout}`;
    document.body.dataset.ready = 'true';
}
main().catch((error) => {
    status.textContent = error.stack;
    window.engineMigrationError = String(error);
    console.error(error);
});
