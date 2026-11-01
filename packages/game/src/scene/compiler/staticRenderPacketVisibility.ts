import {
    ArrayCamera,
    Box3,
    type BufferAttribute,
    type BufferGeometry,
    type Camera,
    Euler,
    Frustum,
    type FrustumArray,
    InstancedMesh,
    type InterleavedBufferAttribute,
    type Intersection,
    type Material,
    Matrix4,
    Mesh,
    type Object3D,
    Quaternion,
    type Raycaster,
    Sphere,
    Vector3,
    type WebGLRenderer,
} from 'three';
import type { StaticRenderPacket } from './staticRenderPackets';

type DrawRange = { start: number; count: number };
type PacketRange = DrawRange & {
    group: number;
    positionStart: number;
    positionCount: number;
};
type RangeOwner = { geometry: BufferGeometry; range: DrawRange };
type RangeStack = {
    depth: number;
    entries: { owner: RangeOwner; range: DrawRange }[];
};

/** Morph bounds and partial authored ranges retain the pre-stock path. */
export function supportsStaticPacketVisibility(geometry: BufferGeometry) {
    const position = geometry.getAttribute('position');
    return Boolean(
        position &&
            Object.values(geometry.morphAttributes).every(
                (attributes) => attributes.length === 0,
            ) &&
            geometry.drawRange.start === 0 &&
            geometry.drawRange.count >=
                (geometry.index?.count ?? position.count),
    );
}

/** Shared buffers need their original range restored even when a draw throws. */
export class StaticRenderPacketDrawRanges {
    private readonly fullRanges = new WeakMap<BufferGeometry, DrawRange>();
    private readonly stacks = new WeakMap<BufferGeometry, RangeStack>();
    private readonly activeGeometries = new Set<BufferGeometry>();
    private readonly scopes: Map<BufferGeometry, number>[] = [];
    private depth = 0;
    private readonly cameraModes: boolean[] = [];

    get allowsRangeCoalescing() {
        return this.cameraModes[this.depth - 1] ?? true;
    }
    private preparation:
        | ((scene: Object3D, camera: Camera) => void)
        | undefined;

    prepareRender(scene: Object3D, camera: Camera) {
        // Nested capture/outline renders keep their range scope, but must not
        // mutate Three's outer render state with a compile traversal.
        if (this.depth === 1) this.preparation?.(scene, camera);
    }

    registerPreparation(callback: (scene: Object3D, camera: Camera) => void) {
        this.preparation = callback;
        return () => {
            if (this.preparation === callback) this.preparation = undefined;
        };
    }

    enter(owner: RangeOwner) {
        const geometry = owner.geometry;
        if (!this.fullRanges.has(geometry))
            this.fullRanges.set(geometry, { ...geometry.drawRange });
        let stack = this.stacks.get(geometry);
        if (!stack) {
            stack = { depth: 0, entries: [] };
            this.stacks.set(geometry, stack);
        }
        const scope = this.scopes[this.depth - 1];
        if (scope && !scope.has(geometry)) scope.set(geometry, stack.depth);
        // Snapshot the selected span: nested draws can select another camera's
        // span on the same mesh. Reuse entries after their stack frame exits.
        let entry = stack.entries[stack.depth++];
        if (!entry) {
            entry = { owner, range: { ...owner.range } };
            stack.entries.push(entry);
        } else {
            entry.owner = owner;
            entry.range.start = owner.range.start;
            entry.range.count = owner.range.count;
        }
        this.activeGeometries.add(geometry);
        geometry.setDrawRange(owner.range.start, owner.range.count);
    }

    leave(owner: RangeOwner) {
        const stack = this.stacks.get(owner.geometry);
        if (!stack || stack.entries[stack.depth - 1]?.owner !== owner) return;
        stack.depth--;
        this.restore(owner.geometry, stack);
    }

    private restore(geometry: BufferGeometry, stack: RangeStack) {
        const range =
            stack.entries[stack.depth - 1]?.range ??
            this.fullRanges.get(geometry);
        if (range) geometry.setDrawRange(range.start, range.count);
        if (stack.depth === 0) this.activeGeometries.delete(geometry);
    }

    beginRender(camera?: Camera) {
        let scope = this.scopes[this.depth];
        if (!scope) {
            scope = new Map();
            this.scopes[this.depth] = scope;
        }
        scope.clear();
        this.cameraModes[this.depth] = camera
            ? !(camera instanceof ArrayCamera)
            : this.allowsRangeCoalescing;
        this.depth++;
    }

    endRender() {
        const scope = this.scopes[--this.depth];
        for (const [geometry, depth] of scope) {
            const stack = this.stacks.get(geometry);
            if (!stack) continue;
            stack.depth = depth;
            this.restore(geometry, stack);
        }
        scope.clear();
    }

    render<T>(callback: () => T): T {
        this.beginRender();
        try {
            return callback();
        } finally {
            this.endRender();
        }
    }

    restoreAll() {
        for (const geometry of this.activeGeometries) {
            const stack = this.stacks.get(geometry);
            if (!stack) continue;
            stack.depth = 0;
            this.restore(geometry, stack);
        }
    }
}

type GuardedRenderer = Pick<WebGLRenderer, 'render'>;
const rendererGuards = new WeakMap<
    GuardedRenderer,
    {
        original: WebGLRenderer['render'];
        guarded: WebGLRenderer['render'];
        users: Map<StaticRenderPacketDrawRanges, number>;
        owners: StaticRenderPacketDrawRanges[];
    }
>();

/** Commit-owned renderer guard; borrowed renderer and resources stay owned. */
export function guardStaticRenderPacketDrawRanges(
    renderer: GuardedRenderer,
    ranges: StaticRenderPacketDrawRanges,
) {
    let entry = rendererGuards.get(renderer);
    if (!entry) {
        const original = renderer.render;
        const users = new Map<StaticRenderPacketDrawRanges, number>();
        const state = { original, users, owners: [ranges], guarded: original };
        const guarded: WebGLRenderer['render'] = (...args) => {
            const owners = state.owners;
            for (const owner of owners) owner.beginRender(args[1]);
            try {
                for (const owner of owners) owner.prepareRender(...args);
                return original.apply(renderer, args);
            } finally {
                for (let index = owners.length - 1; index >= 0; index--)
                    owners[index].endRender();
            }
        };
        state.guarded = guarded;
        entry = state;
        rendererGuards.set(renderer, entry);
        renderer.render = guarded;
    }
    const lease = entry;
    lease.users.set(ranges, (lease.users.get(ranges) ?? 0) + 1);
    lease.owners = [...lease.users.keys()];
    let released = false;
    return () => {
        if (released) return;
        released = true;
        const count = lease.users.get(ranges) ?? 0;
        if (count > 1) lease.users.set(ranges, count - 1);
        else {
            ranges.restoreAll();
            lease.users.delete(ranges);
        }
        lease.owners = [...lease.users.keys()];
        if (lease.users.size > 0) return;
        if (renderer.render === lease.guarded) renderer.render = lease.original;
        if (rendererGuards.get(renderer) === lease)
            rendererGuards.delete(renderer);
    };
}

function sphereFromPositionRanges(
    position: BufferAttribute | InterleavedBufferAttribute,
    ranges: readonly Pick<PacketRange, 'positionStart' | 'positionCount'>[],
) {
    const box = new Box3();
    const vertex = new Vector3();
    for (const range of ranges)
        for (
            let index = range.positionStart;
            index < range.positionStart + range.positionCount;
            index++
        )
            box.expandByPoint(vertex.fromBufferAttribute(position, index));
    const sphere = new Sphere();
    box.getCenter(sphere.center);
    let radiusSquared = 0;
    for (const range of ranges)
        for (
            let index = range.positionStart;
            index < range.positionStart + range.positionCount;
            index++
        )
            radiusSquared = Math.max(
                radiusSquared,
                sphere.center.distanceToSquared(
                    vertex.fromBufferAttribute(position, index),
                ),
            );
    sphere.radius = Math.sqrt(radiusSquared);
    return sphere;
}

/** Matches InstancedMesh's Float32 matrix upload and ordered sphere unions. */
function originalInstancedSphere(
    contribution: StaticRenderPacket['contributions'][number],
) {
    const geometry = contribution.fallbackGeometry ?? contribution.geometry;
    const position = geometry.getAttribute('position');
    const sourceSphere =
        geometry.boundingSphere ??
        sphereFromPositionRanges(position, [
            { positionStart: 0, positionCount: position.count },
        ]);
    const result = new Sphere().makeEmpty();
    const root = new Matrix4();
    const local = new Matrix4();
    const matrix = new Matrix4();
    const rounded = new Float32Array(16);
    const center = new Vector3();
    const axis = new Vector3(0, 1, 0);
    const unit = new Vector3(1, 1, 1);
    const quaternion = new Quaternion();
    const instanceSphere = new Sphere();
    const scale = contribution.scale;
    local.compose(
        new Vector3(...contribution.localTransform.position),
        new Quaternion().setFromEuler(
            new Euler(...contribution.localTransform.rotation),
        ),
        Array.isArray(scale)
            ? new Vector3(...scale)
            : new Vector3(scale ?? 1, scale ?? 1, scale ?? 1),
    );
    for (const instance of contribution.instances) {
        root.compose(
            center.fromArray(instance.position),
            quaternion.setFromAxisAngle(
                axis,
                (instance.rotation * Math.PI) / 2,
            ),
            unit,
        );
        matrix.multiplyMatrices(root, local).toArray(rounded);
        matrix.fromArray(rounded);
        result.union(instanceSphere.copy(sourceSphere).applyMatrix4(matrix));
    }
    return result;
}

type Visibility = {
    all: boolean;
    values: Uint8Array;
    matrix: Matrix4;
    planes: Float64Array;
    counts?: Float64Array;
    countsReady: boolean;
};

// Cameras are borrowed. Cache only their current matrices, with no frame-loop
// subscription or GPU resource; moving lights (including cube faces) refresh it.
const cameraFrusta = new WeakMap<
    Camera,
    {
        projection: Matrix4;
        inverse: Matrix4;
        reversedDepth: boolean;
        coordinateSystem: Camera['coordinateSystem'];
        frustum: Frustum;
        matrix: Matrix4;
    }
>();

function cameraFrustum(camera: Camera) {
    let entry = cameraFrusta.get(camera);
    if (!entry) {
        entry = {
            projection: new Matrix4(),
            inverse: new Matrix4(),
            reversedDepth: camera.reversedDepth,
            coordinateSystem: camera.coordinateSystem,
            frustum: new Frustum(),
            matrix: new Matrix4(),
        };
        // Force the first calculation even for identity cameras.
        entry.projection.elements.fill(Number.NaN);
        cameraFrusta.set(camera, entry);
    }
    if (
        !entry.projection.equals(camera.projectionMatrix) ||
        !entry.inverse.equals(camera.matrixWorldInverse) ||
        entry.reversedDepth !== camera.reversedDepth ||
        entry.coordinateSystem !== camera.coordinateSystem
    ) {
        entry.projection.copy(camera.projectionMatrix);
        entry.inverse.copy(camera.matrixWorldInverse);
        entry.reversedDepth = camera.reversedDepth;
        entry.coordinateSystem = camera.coordinateSystem;
        entry.frustum.setFromProjectionMatrix(
            entry.matrix.multiplyMatrices(entry.projection, entry.inverse),
            camera.coordinateSystem,
            camera.reversedDepth,
        );
    }
    return entry.frustum;
}

class PacketVisibility {
    private readonly entries = new WeakMap<
        Frustum | FrustumArray,
        Visibility
    >();
    private readonly worldSphere = new Sphere();

    constructor(
        readonly groups: readonly Sphere[],
        private readonly ranges: readonly PacketRange[],
    ) {}

    drawCount(index: number, camera: Camera, matrix: Matrix4) {
        return this.drawCountInFrustum(index, cameraFrustum(camera), matrix);
    }

    drawCountInFrustum(index: number, frustum: Frustum, matrix: Matrix4) {
        const entry = this.read(frustum, matrix);
        entry.counts ??= new Float64Array(this.ranges.length);
        const counts = entry.counts;
        if (!entry.countsReady) {
            // Preserve source order and never cross an invisible or empty range.
            // Only the first source in a visible run submits the combined span.
            let leader = -1;
            let end = -1;
            for (let index = 0; index < this.ranges.length; index++) {
                const range = this.ranges[index];
                counts[index] = 0;
                if (!entry.values[range.group] || range.count === 0) {
                    leader = -1;
                    end = -1;
                    continue;
                }
                if (leader >= 0 && range.start === end)
                    counts[leader] += range.count;
                else {
                    leader = index;
                    counts[index] = range.count;
                }
                end = range.start + range.count;
            }
            entry.countsReady = true;
        }
        return counts[index];
    }

    read(frustum: Frustum | FrustumArray, matrix: Matrix4) {
        let entry = this.entries.get(frustum);
        if (!entry) {
            entry = {
                all: false,
                values: new Uint8Array(this.groups.length),
                matrix: new Matrix4(),
                planes: new Float64Array(24).fill(Number.NaN),
                countsReady: false,
            };
            this.entries.set(frustum, entry);
        }
        let unchanged = entry.matrix.equals(matrix);
        // Stereo frusta are less common; evaluating the actual union remains
        // correct without assuming which child frustum changed.
        if ('planes' in frustum) {
            for (let index = 0; index < frustum.planes.length; index++) {
                const plane = frustum.planes[index];
                const offset = index * 4;
                unchanged &&=
                    entry.planes[offset] === plane.normal.x &&
                    entry.planes[offset + 1] === plane.normal.y &&
                    entry.planes[offset + 2] === plane.normal.z &&
                    entry.planes[offset + 3] === plane.constant;
                entry.planes[offset] = plane.normal.x;
                entry.planes[offset + 1] = plane.normal.y;
                entry.planes[offset + 2] = plane.normal.z;
                entry.planes[offset + 3] = plane.constant;
            }
        } else unchanged = false;
        if (unchanged) return entry;
        entry.countsReady = false;
        entry.matrix.copy(matrix);
        entry.all = true;
        for (let index = 0; index < this.groups.length; index++) {
            const visible = frustum.intersectsSphere(
                this.worldSphere.copy(this.groups[index]).applyMatrix4(matrix),
            );
            entry.values[index] = visible ? 1 : 0;
            entry.all &&= visible;
        }
        return entry;
    }
}

/**
 * Full-visible packets keep one draw. Mixed visibility submits only the
 * original groups' existing compiled ranges, sharing the same GPU buffers.
 * Custom callbacks deliberately keep these meshes outside cache replay.
 */
export class StaticRenderPacketVisibilityMesh extends Mesh<
    BufferGeometry,
    Material
> {
    private presentationEnabled = true;
    private readonly drawOwner: RangeOwner;

    setPresentationEnabled(enabled: boolean) {
        this.presentationEnabled = enabled;
        this.visible = enabled;
    }
    constructor(
        geometry: BufferGeometry,
        material: StaticRenderPacket['material'],
        readonly range: DrawRange,
        private readonly group: number | undefined,
        private readonly visibility: PacketVisibility,
        private readonly ranges: StaticRenderPacketDrawRanges,
        private readonly rangeIndex?: number,
    ) {
        super(geometry, material);
        this.drawOwner = { geometry, range: { ...range } };
    }

    override intersectsFrustum(frustum: Frustum | FrustumArray) {
        if (this.range.count === 0) return false;
        const visible = this.visibility.read(frustum, this.matrixWorld);
        return this.group === undefined
            ? visible.all
            : !visible.all &&
                  visible.values[this.group] === 1 &&
                  (!this.ranges.allowsRangeCoalescing ||
                      this.rangeIndex === undefined ||
                      !('planes' in frustum) ||
                      this.visibility.drawCountInFrustum(
                          this.rangeIndex,
                          frustum,
                          this.matrixWorld,
                      ) > 0);
    }

    override raycast(raycaster: Raycaster, intersections: Intersection[]) {
        // Whole-scene occlusion queries must intersect each source range once,
        // including sources outside the current render camera's frustum.
        if (
            !this.presentationEnabled ||
            this.group === undefined ||
            this.range.count === 0
        )
            return;
        this.ranges.enter(this);
        try {
            super.raycast(raycaster, intersections);
        } finally {
            this.ranges.leave(this);
        }
    }

    override onBeforeRender(
        _renderer?: WebGLRenderer,
        _scene?: Object3D,
        camera?: Camera,
    ) {
        this.drawOwner.range.count =
            camera &&
            this.rangeIndex !== undefined &&
            this.frustumCulled &&
            this.ranges.allowsRangeCoalescing &&
            !(camera instanceof ArrayCamera)
                ? this.visibility.drawCount(
                      this.rangeIndex,
                      camera,
                      this.matrixWorld,
                  )
                : this.range.count;
        this.ranges.enter(this.drawOwner);
    }

    override onAfterRender() {
        this.ranges.leave(this.drawOwner);
    }

    override onBeforeShadow(
        renderer?: WebGLRenderer,
        object?: Object3D,
        _camera?: Camera,
        shadowCamera?: Camera,
    ) {
        this.onBeforeRender(renderer, object, shadowCamera);
    }

    override onAfterShadow() {
        this.ranges.leave(this.drawOwner);
    }
}

/** Baked stock positions use one identity instance, retaining their authored shader variant. */
export class StaticRenderPacketVisibilityInstancedMesh extends InstancedMesh<
    BufferGeometry,
    Material
> {
    private presentationEnabled = true;
    private readonly drawOwner: RangeOwner;

    setPresentationEnabled(enabled: boolean) {
        this.presentationEnabled = enabled;
        this.visible = enabled;
    }

    constructor(
        geometry: BufferGeometry,
        material: StaticRenderPacket['material'],
        readonly range: DrawRange,
        private readonly group: number | undefined,
        private readonly visibility: PacketVisibility,
        private readonly ranges: StaticRenderPacketDrawRanges,
        private readonly rangeIndex?: number,
    ) {
        super(geometry, material, 1);
        this.matrixAutoUpdate = false;
        this.drawOwner = { geometry, range: { ...range } };
    }

    override intersectsFrustum(frustum: Frustum | FrustumArray) {
        if (this.range.count === 0) return false;
        const visible = this.visibility.read(frustum, this.matrixWorld);
        return this.group === undefined
            ? visible.all
            : !visible.all &&
                  visible.values[this.group] === 1 &&
                  (!this.ranges.allowsRangeCoalescing ||
                      this.rangeIndex === undefined ||
                      !('planes' in frustum) ||
                      this.visibility.drawCountInFrustum(
                          this.rangeIndex,
                          frustum,
                          this.matrixWorld,
                      ) > 0);
    }

    override raycast(raycaster: Raycaster, intersections: Intersection[]) {
        if (
            !this.presentationEnabled ||
            this.group === undefined ||
            this.range.count === 0
        )
            return;
        this.ranges.enter(this);
        try {
            // Geometry already contains every source transform. Preserve the
            // compiled range's face/UV semantics without a synthetic instanceId.
            Mesh.prototype.raycast.call(this, raycaster, intersections);
        } finally {
            this.ranges.leave(this);
        }
    }

    override onBeforeRender(
        _renderer?: WebGLRenderer,
        _scene?: Object3D,
        camera?: Camera,
    ) {
        this.drawOwner.range.count =
            camera &&
            this.rangeIndex !== undefined &&
            this.frustumCulled &&
            this.ranges.allowsRangeCoalescing &&
            !(camera instanceof ArrayCamera)
                ? this.visibility.drawCount(
                      this.rangeIndex,
                      camera,
                      this.matrixWorld,
                  )
                : this.range.count;
        this.ranges.enter(this.drawOwner);
    }

    override onAfterRender() {
        this.ranges.leave(this.drawOwner);
    }

    override onBeforeShadow(
        renderer?: WebGLRenderer,
        object?: Object3D,
        _camera?: Camera,
        shadowCamera?: Camera,
    ) {
        this.onBeforeRender(renderer, object, shadowCamera);
    }

    override onAfterShadow() {
        this.ranges.leave(this.drawOwner);
    }
}

/** Only our exact range callbacks are static; other custom callbacks fail closed. */
export function hasStaticRenderPacketVisibilityCallbacks(object: Object3D) {
    const prototype =
        object instanceof StaticRenderPacketVisibilityInstancedMesh
            ? StaticRenderPacketVisibilityInstancedMesh.prototype
            : object instanceof StaticRenderPacketVisibilityMesh
              ? StaticRenderPacketVisibilityMesh.prototype
              : undefined;
    return Boolean(
        prototype &&
            object.onBeforeRender === prototype.onBeforeRender &&
            object.onAfterRender === prototype.onAfterRender &&
            object.onBeforeShadow === prototype.onBeforeShadow &&
            object.onAfterShadow === prototype.onAfterShadow,
    );
}

export function createStaticRenderPacketVisibilityMeshes(
    packet: StaticRenderPacket,
    geometry: BufferGeometry,
    drawRanges: StaticRenderPacketDrawRanges,
    name: string,
    presentationEnabled = true,
) {
    const groups: Sphere[] = [];
    const groupKeys = new Map<string, number>();
    const ranges: PacketRange[] = [];
    const compiledGroups = new Map<number, PacketRange[]>();
    let positionStart = 0;
    let start = 0;
    for (const contribution of packet.contributions) {
        const groupKey =
            contribution.originalVisibilityGroup ?? contribution.id;
        let group = groupKeys.get(groupKey);
        if (group === undefined) {
            group = groups.length;
            groupKeys.set(groupKey, group);
            groups.push(new Sphere());
        }
        const vertices = contribution.geometry.getAttribute('position').count;
        const positionCount = vertices * contribution.instances.length;
        const count =
            (contribution.geometry.index?.count ?? vertices) *
            contribution.instances.length;
        const range = { start, count, positionStart, positionCount, group };
        ranges.push(range);
        if (contribution.originalVisibilityMode === 'compiled') {
            const old = compiledGroups.get(group);
            if (old) old.push(range);
            else compiledGroups.set(group, [range]);
        } else groups[group].copy(originalInstancedSphere(contribution));
        positionStart += positionCount;
        start += count;
    }
    const position = geometry.getAttribute('position');
    for (const [group, ranges] of compiledGroups)
        groups[group].copy(sphereFromPositionRanges(position, ranges));
    const visibility = new PacketVisibility(groups, ranges);
    const VisibilityMesh = packet.contributions.every(
        ({ originalVisibilityMode, sourceBoundsCulling }) =>
            sourceBoundsCulling && originalVisibilityMode === 'instanced',
    )
        ? StaticRenderPacketVisibilityInstancedMesh
        : StaticRenderPacketVisibilityMesh;
    const meshes = [
        new VisibilityMesh(
            geometry,
            packet.material,
            { start: 0, count: start },
            undefined,
            visibility,
            drawRanges,
        ),
        ...ranges.map(
            (range, index) =>
                new VisibilityMesh(
                    geometry,
                    packet.material,
                    range,
                    range.group,
                    visibility,
                    drawRanges,
                    index,
                ),
        ),
    ];
    for (const [index, mesh] of meshes.entries()) {
        mesh.name = index === 0 ? name : `${name}:visible-range:${index - 1}`;
        mesh.castShadow = packet.castShadow;
        mesh.receiveShadow = packet.receiveShadow;
        mesh.renderOrder = packet.renderOrder ?? 0;
        mesh.setPresentationEnabled(presentationEnabled);
    }
    return meshes;
}
