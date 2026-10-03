import {
    Box3,
    type BufferAttribute,
    type BufferGeometry,
    type Camera,
    Euler,
    type Frustum,
    type FrustumArray,
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
    private readonly stacks = new WeakMap<BufferGeometry, RangeOwner[]>();
    private readonly activeGeometries = new Set<BufferGeometry>();
    private readonly scopes: Map<BufferGeometry, number>[] = [];
    private depth = 0;
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
            stack = [];
            this.stacks.set(geometry, stack);
        }
        const scope = this.scopes[this.depth - 1];
        if (scope && !scope.has(geometry)) scope.set(geometry, stack.length);
        stack.push(owner);
        this.activeGeometries.add(geometry);
        geometry.setDrawRange(owner.range.start, owner.range.count);
    }

    leave(owner: RangeOwner) {
        const stack = this.stacks.get(owner.geometry);
        if (stack?.at(-1) !== owner) return;
        stack.pop();
        this.restore(owner.geometry, stack);
    }

    private restore(geometry: BufferGeometry, stack: RangeOwner[]) {
        const range = stack.at(-1)?.range ?? this.fullRanges.get(geometry);
        if (range) geometry.setDrawRange(range.start, range.count);
        if (stack.length === 0) this.activeGeometries.delete(geometry);
    }

    beginRender() {
        let scope = this.scopes[this.depth];
        if (!scope) {
            scope = new Map();
            this.scopes[this.depth] = scope;
        }
        scope.clear();
        this.depth++;
    }

    endRender() {
        const scope = this.scopes[--this.depth];
        for (const [geometry, depth] of scope) {
            const stack = this.stacks.get(geometry);
            if (!stack) continue;
            stack.length = depth;
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
            stack.length = 0;
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
            for (const owner of owners) owner.beginRender();
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
};

class PacketVisibility {
    private readonly entries = new WeakMap<
        Frustum | FrustumArray,
        Visibility
    >();
    private readonly worldSphere = new Sphere();

    constructor(readonly groups: readonly Sphere[]) {}

    read(frustum: Frustum | FrustumArray, matrix: Matrix4) {
        let entry = this.entries.get(frustum);
        if (!entry) {
            entry = {
                all: false,
                values: new Uint8Array(this.groups.length),
                matrix: new Matrix4(),
                planes: new Float64Array(24).fill(Number.NaN),
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
    ) {
        super(geometry, material);
    }

    override intersectsFrustum(frustum: Frustum | FrustumArray) {
        if (this.range.count === 0) return false;
        const visible = this.visibility.read(frustum, this.matrixWorld);
        return this.group === undefined
            ? visible.all
            : !visible.all && visible.values[this.group] === 1;
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

    override onBeforeRender() {
        this.ranges.enter(this);
    }

    override onAfterRender() {
        this.ranges.leave(this);
    }

    override onBeforeShadow() {
        this.ranges.enter(this);
    }

    override onAfterShadow() {
        this.ranges.leave(this);
    }
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
    const visibility = new PacketVisibility(groups);
    const meshes = [
        new StaticRenderPacketVisibilityMesh(
            geometry,
            packet.material,
            { start: 0, count: start },
            undefined,
            visibility,
            drawRanges,
        ),
        ...ranges.map(
            (range) =>
                new StaticRenderPacketVisibilityMesh(
                    geometry,
                    packet.material,
                    range,
                    range.group,
                    visibility,
                    drawRanges,
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
