import {
    Color,
    DoubleSide,
    type IUniform,
    LinearSRGBColorSpace,
    MeshStandardMaterial,
    type Vector4,
} from 'three';
import {
    type LinearRgb,
    litWaterSurfaceRoughness,
    waterAlbedoPalette,
    waterGlintStrength,
    waterSurfaceSheenCap,
} from '../scene/waterColorState';
import { snowPresets } from '../snow/snowPresets';
import {
    resolveSnowSettleAmountRange,
    resolveSnowSettleThickness,
    snowCoverRules,
} from '../snow/snowShader';
import type { WaterBlockStyle } from './waterBlockNames';
import {
    waterfallSpillAbove,
    waterfallSpillBelow,
} from './waterfall/waterfallExtrasGeometry';
import {
    waterfallIslandBaseY,
    waterfallVoidFloorY,
} from './waterfall/waterfallPlacements';

/** How fast the streaks of a waterfall slide down, in units per second. */
export const waterfallFlowSpeed = 0.55;

/**
 * Snow on a support block's grass lip, which a spill pours over: the snow
 * overlay's grass preset (`snow/snowPresets.ts`), thickest where its noise
 * peaks (`SnowOverlay` noise amplitude 0.35), growing over the end of its
 * settle range (`snow/snowShader.ts`).
 */
const lipSnow = snowPresets.grassFlat;
const lipSnowSettleRange = resolveSnowSettleAmountRange(
    lipSnow.settleCm,
    lipSnow.coverageMultiplier,
);
const lipSnowGrowsFrom =
    lipSnowSettleRange[0] +
    (lipSnowSettleRange[1] - lipSnowSettleRange[0]) *
        snowCoverRules.settleThicknessFrom;
const lipSnowMaxThickness = lipSnow.maxThickness * 1.35;
/** Share of the lift a spill's shoulder also moves out by, past the snow. */
const lipSnowOutwardShare = 0.2;

/**
 * How far a spill's shoulder lifts over the snow on the lip it pours across
 * at this grass snow amount (the CPU twin of the extras vertex shader): as
 * thick as the lip's snow can grow, so the fall never breaks at a snowy
 * ledge. Where the landing is barely below the shoulder's foot
 * (`floorBelowShoulder`), as on the high end of a ramp beside the support,
 * the ground's own snow buries the lip, so the shoulder lifts less and
 * stays under it there.
 */
export function resolveWaterfallLipSnowLift(
    amount: number,
    floorBelowShoulder: number,
) {
    const t = Math.min(
        1,
        Math.max(0, floorBelowShoulder / lipSnowMaxThickness),
    );
    return (
        lipSnowMaxThickness *
        Math.min(1, Math.max(0, amount)) *
        resolveSnowSettleThickness(amount, lipSnowSettleRange) *
        (t * t * (3 - 2 * t))
    );
}
/** Lattice period of the waterfall noise, in cells. */
const waterfallNoisePeriod = 64;

const waterVertexDeclarations = /* glsl */ `
uniform float uWaterDepth;
uniform float uWaterTopLocalY;

varying vec3 vWaterLocalPosition;
varying vec3 vWaterLocalNormal;
varying vec3 vWaterWorldPosition;
varying float vWaterTopness;
varying float vWaterColumnDepth;
varying float vWaterSurfaceY;
varying float vWaterShoreDepth;
#ifdef USE_WATER_LOCAL_POSITION_ATTRIBUTE
attribute vec3 waterLocalPosition;
#endif
#ifdef USE_WATER_DEPTH_ATTRIBUTE
attribute float waterDepth;
attribute float waterSurfaceY;
#endif
#ifdef USE_WATER_SHORE_DEPTH_ATTRIBUTE
attribute float waterShoreDepth;
#endif
#ifdef USE_WATER_FOAM_ATTRIBUTES
attribute vec4 waterFoamEdges;
attribute vec4 waterFoamCorners;
varying vec4 vWaterFoamEdges;
varying vec4 vWaterFoamCorners;
#endif
#ifdef USE_WATER_FALL_SIDES
attribute float waterFallFloor;
varying float vWaterFallFloor;
#endif
#ifdef USE_WATER_FALL_EXTRAS
attribute vec4 waterfallShape;
varying vec4 vWaterfallShape;
uniform float uWaterfallSnow;
#endif
`;

/**
 * Snow on a support block's grass lip grows up and out over the spill that
 * pours across it. The sheet's shoulder (its rows from just under the
 * support's top up) lifts over the snow and its foot moves out past it, so
 * the fall carries on unbroken over a snowy ledge, less where the landing
 * is nearly as high as the lip (\`resolveWaterfallLipSnowLift\`).
 */
const waterfallExtrasVertex = /* glsl */ `
#ifdef USE_WATER_FALL_EXTRAS
{
    float sheetTop = waterfallShape.w;
    bool isSheet = waterfallShape.x < 0.5 || waterfallShape.x > 2.5;
    float shoulderFoot = sheetTop - ${waterfallSpillBelow.toFixed(3)};
    // A spill's ground beside its lip, a run-out's island base.
    float liftFloor = waterfallShape.x > 2.5 ? waterfallShape.z : waterfallShape.y;
    float shoulder = ( position.y - shoulderFoot ) /
        ${(waterfallSpillAbove + waterfallSpillBelow).toFixed(3)};
    if ( isSheet && sheetTop > ${(waterfallIslandBaseY + 0.01).toFixed(3)} && shoulder > -0.001 ) {
        float lipSnow = ${lipSnowMaxThickness.toFixed(4)} *
            clamp( uWaterfallSnow, 0.0, 1.0 ) *
            smoothstep( ${lipSnowGrowsFrom.toFixed(4)}, ${lipSnowSettleRange[1].toFixed(4)}, uWaterfallSnow ) *
            smoothstep( 0.0, ${lipSnowMaxThickness.toFixed(4)}, shoulderFoot - liftFloor );
        transformed.y += lipSnow;
        float outwardLength = length( normal.xz );
        if ( outwardLength > 0.001 ) {
            transformed.xz += normal.xz / outwardLength * lipSnow *
                ${lipSnowOutwardShare.toFixed(2)} * ( 1.0 - clamp( shoulder, 0.0, 1.0 ) );
        }
    }
}
#endif
`;

const waterVertexMain = /* glsl */ `
vec4 waterWorldPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
    waterWorldPosition = instanceMatrix * waterWorldPosition;
#endif
waterWorldPosition = modelMatrix * waterWorldPosition;

vWaterLocalPosition = position;
#ifdef USE_WATER_LOCAL_POSITION_ATTRIBUTE
    vWaterLocalPosition = waterLocalPosition;
#endif
vWaterLocalNormal = normal;
vWaterWorldPosition = waterWorldPosition.xyz;
vWaterTopness = smoothstep( 0.5, 0.95, normal.y );
vWaterColumnDepth = uWaterDepth;
// A single block knows its own top, so its sides can still shade by
// distance below the surface.
vWaterSurfaceY = waterWorldPosition.y + ( uWaterTopLocalY - position.y );
#ifdef USE_WATER_DEPTH_ATTRIBUTE
    vWaterColumnDepth = waterDepth;
    vWaterSurfaceY = waterSurfaceY;
#endif
vWaterShoreDepth = 0.0;
#ifdef USE_WATER_SHORE_DEPTH_ATTRIBUTE
    vWaterShoreDepth = waterShoreDepth;
#endif
#ifdef USE_WATER_FOAM_ATTRIBUTES
    vWaterFoamEdges = waterFoamEdges;
    vWaterFoamCorners = waterFoamCorners;
#endif
#ifdef USE_WATER_FALL_SIDES
    vWaterFallFloor = waterFallFloor;
#endif
#ifdef USE_WATER_FALL_EXTRAS
    vWaterfallShape = waterfallShape;
#endif
`;

/**
 * Shared look of falling water: the wall of an exposed side, the lip above
 * it and the run-out below the island all use the same streaks, so they
 * read as one sheet.
 */
const waterfallFragmentFunctions = /* glsl */ `
#if defined( USE_WATER_FALL_SIDES ) || defined( USE_WATER_FALL_LIP ) || defined( USE_WATER_FALL_EXTRAS )
// Hash without sine. Sine hashes lose their spread on some GPUs once the
// lattice gets large, and a waterfall's flow runs on with scene time.
float waterfallHash( vec2 p ) {
    vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
    p3 += dot( p3, p3.yzx + 33.33 );
    return fract( ( p3.x + p3.y ) * p3.z );
}

// Value noise that repeats every ${waterfallNoisePeriod.toFixed(1)} lattice cells, so lattice
// coordinates stay small and a time offset can wrap without a jump.
float waterfallNoise( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    vec2 i0 = mod( i, ${waterfallNoisePeriod.toFixed(1)} );
    vec2 i1 = mod( i + 1.0, ${waterfallNoisePeriod.toFixed(1)} );
    float a = waterfallHash( i0 );
    float b = waterfallHash( vec2( i1.x, i0.y ) );
    float c = waterfallHash( vec2( i0.x, i1.y ) );
    float d = waterfallHash( i1 );
    return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

// Scene time as a lattice offset at \`rate\` cells per second, wrapped to
// the noise period.
float waterfallTimeCells( float rate ) {
    return mod( uTime * rate, ${waterfallNoisePeriod.toFixed(1)} );
}

// Position across a fall. A column's corner shares its world point with
// both sides, so the streaks carry on round every corner without a break.
float waterfallAcross( vec3 world ) {
    return world.x - world.z;
}

// Light dashes of falling water sliding down at the fall speed: about 0.06
// across and 0.5 long, so they read as streaks and never as speckle. 0
// between dashes, 1 on one.
float waterfallStreaks( vec3 world, float surfaceY ) {
    float across = waterfallAcross( world );
    float below = surfaceY - world.y;
    float dashes = waterfallNoise( vec2(
        across * 8.5,
        below * 1.5 - waterfallTimeCells( ${(waterfallFlowSpeed * 1.5).toFixed(4)} )
    ) );
#ifdef WATER_FALL_SIMPLE
    float streak = dashes;
#else
    // A slower, longer layer keeps the dashes from lining up in rows.
    float lanes = waterfallNoise( vec2(
        across * 4.2 + 3.7,
        below * 0.5 - waterfallTimeCells( ${(waterfallFlowSpeed * 0.5).toFixed(4)} )
    ) );
    float streak = dashes * 0.75 + lanes * 0.25;
#endif
    return smoothstep( 0.56, 0.64, streak );
}

// Body of falling water: a little lighter than still water's side, with the
// dashes lifted toward foam.
vec3 waterfallBody( vec3 sideTone, float streaks ) {
    vec3 body = mix( sideTone, uWaterShallow, 0.22 );
    return mix( body, mix( body, uWaterFoam, 0.6 ), streaks );
}

// Keeps a foam line from running ruler-straight. -0.5 to 0.5.
float waterfallWobble( vec3 world ) {
#ifdef WATER_FALL_SIMPLE
    return waterfallNoise( vec2( waterfallAcross( world ) * 6.0, 0.5 ) ) - 0.5;
#else
    return waterfallNoise( vec2(
        waterfallAcross( world ) * 6.0 + waterfallTimeCells( 0.7 ),
        waterfallTimeCells( 0.9 )
    ) ) - 0.5;
#endif
}

// White churn where falling water lands on \`floorY\`: a wavy band just over
// the floor, with soft but definite edges. 0 to 1.
float waterfallSplash( vec3 world, float floorY ) {
    float above = world.y - floorY;
    return 1.0 - smoothstep( 0.03, 0.05, above + waterfallWobble( world ) * 0.03 );
}
#endif
`;

const waterFragmentDeclarations = /* glsl */ `
uniform float uTime;
uniform vec3 uWaterShallow;
uniform vec3 uWaterDeep;
uniform vec3 uWaterSide;
uniform vec3 uWaterFoam;
uniform vec3 uWaterAlgae;
uniform float uAlgaeStrength;
uniform vec4 uFoamEdges;
uniform vec4 uFoamCorners;
uniform float uDiscardInnerEdges;

varying vec3 vWaterLocalPosition;
varying vec3 vWaterLocalNormal;
varying vec3 vWaterWorldPosition;
varying float vWaterTopness;
varying float vWaterColumnDepth;
varying float vWaterSurfaceY;
varying float vWaterShoreDepth;
#ifdef USE_WATER_FOAM_ATTRIBUTES
varying vec4 vWaterFoamEdges;
varying vec4 vWaterFoamCorners;
#endif
#ifdef USE_WATER_FALL_SIDES
varying float vWaterFallFloor;
#endif
#ifdef USE_WATER_FALL_EXTRAS
varying vec4 vWaterfallShape;
uniform float uWaterfallSnow;
#endif

float waterHash( vec2 p ) {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}

float waterNoise( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    float a = waterHash( i );
    float b = waterHash( i + vec2( 1.0, 0.0 ) );
    float c = waterHash( i + vec2( 0.0, 1.0 ) );
    float d = waterHash( i + vec2( 1.0, 1.0 ) );
    return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

// Turns noise lookups off the tile grid, so no edge of the noise lattice
// lines up with the tiles and reads as a seam or a square blotch.
const mat2 waterNoiseTurnA = mat2( 0.8, -0.6, 0.6, 0.8 );
const mat2 waterNoiseTurnB = mat2( 0.28, 0.96, -0.96, 0.28 );

float waterBankDistance( float distanceToEdge, float isBank ) {
    return mix( 8.0, distanceToEdge, step( 0.5, isBank ) );
}

// Distance from this point of a tile to the nearest bank: the tile's own
// shore sides, plus the corner point of an inner corner where only the
// diagonal neighbour is dry. Exact within half a tile of the bank, which is
// all the edge band needs.
float resolveWaterBankDistance( vec2 local, vec4 edges, vec4 corners ) {
    float distanceToBank = 8.0;
    distanceToBank = min( distanceToBank, waterBankDistance( local.x + 0.5, edges.x ) );
    distanceToBank = min( distanceToBank, waterBankDistance( 0.5 - local.x, edges.y ) );
    distanceToBank = min( distanceToBank, waterBankDistance( local.y + 0.5, edges.z ) );
    distanceToBank = min( distanceToBank, waterBankDistance( 0.5 - local.y, edges.w ) );
    distanceToBank = min( distanceToBank, waterBankDistance( length( local - vec2( -0.5, -0.5 ) ), corners.x ) );
    distanceToBank = min( distanceToBank, waterBankDistance( length( local - vec2( 0.5, -0.5 ) ), corners.y ) );
    distanceToBank = min( distanceToBank, waterBankDistance( length( local - vec2( -0.5, 0.5 ) ), corners.z ) );
    distanceToBank = min( distanceToBank, waterBankDistance( length( local - vec2( 0.5, 0.5 ) ), corners.w ) );
    return distanceToBank;
}
${waterfallFragmentFunctions}
`;

/**
 * An exposed side whose water falls is the falling sheet: a foam crest runs
 * under the lip, streaks slide down and the water churns white where it
 * lands. A covered side carries its own surface as its floor and stays
 * still water.
 */
const waterfallSideAlbedo = /* glsl */ `
#ifdef USE_WATER_FALL_SIDES
if ( vWaterSurfaceY - vWaterFallFloor > 0.03 ) {
    float fallBelow = max( vWaterSurfaceY - vWaterWorldPosition.y, 0.0 );
    float fallWobble = waterfallWobble( vWaterWorldPosition );
    float fallLands = step( ${(waterfallVoidFloorY + 1).toFixed(1)}, vWaterFallFloor );
    vec3 fallAlbedo = waterfallBody(
        sideAlbedo,
        waterfallStreaks( vWaterWorldPosition, vWaterSurfaceY )
    );
    // Wavy foam lines with soft but definite edges: a crest under the lip
    // and the churn where the water lands. The floor follows a slope or
    // step beside the wall.
    float fallCrest = 1.0 - smoothstep( 0.084, 0.1, fallBelow + fallWobble * 0.03 );
    float fallSplash = fallLands * waterfallSplash( vWaterWorldPosition, vWaterFallFloor );
    sideAlbedo = mix( fallAlbedo, uWaterFoam, max( fallCrest * 0.55, fallSplash * 0.7 ) );
}
#endif
`;

/**
 * The rounded lip over an exposed side is where the water spills: it foams
 * and the first streaks start on it. Only lips bend away from straight up on
 * a water top, and every lip sits over a fall.
 */
const waterfallLipAlbedo = /* glsl */ `
#ifdef USE_WATER_FALL_LIP
{
    float lip = 1.0 - smoothstep( 0.88, 0.99, vWaterLocalNormal.y );
    vec3 lipAlbedo = mix( mix( uWaterSide, uWaterShallow, 0.5 ), uWaterFoam, 0.45 );
    waterAlbedo = mix( waterAlbedo, lipAlbedo, lip );
}
#endif
`;

/**
 * Landing foam, island-edge run-out and spill (`waterfallExtrasGeometry.ts`).
 * A spill carries the falling sheet over a support block's lip and down to
 * where it lands, churning white at its foot like the wall does. A run-out
 * carries the sheet on past the island base, fades and breaks into a
 * little mist. A landing skirt is soft foam that fades with the distance
 * from the wall, with a ring that rolls out from it; on terrain it melts
 * away as snow settles, since the snow cover would bury it.
 */
const waterfallExtrasAlbedo = /* glsl */ `
#ifdef USE_WATER_FALL_EXTRAS
{
    vec3 extrasAlbedo;
    float extrasAlpha;
    if ( vWaterfallShape.x > 2.5 ) {
        vec3 sheet = waterfallBody(
            sideAlbedo,
            waterfallStreaks( vWaterWorldPosition, vWaterSurfaceY )
        );
        float splash = waterfallSplash( vWaterWorldPosition, vWaterfallShape.y );
        extrasAlbedo = mix( sheet, uWaterFoam, splash * 0.7 );
        extrasAlpha = 1.0;
    } else if ( vWaterfallShape.x < 0.5 ) {
        float fadeTop = vWaterfallShape.y;
        float fadeEnd = vWaterfallShape.z;
        float fade = clamp(
            ( fadeTop - vWaterWorldPosition.y ) / max( fadeTop - fadeEnd, 0.01 ),
            0.0,
            1.0
        );
        vec3 sheet = waterfallBody(
            sideAlbedo,
            waterfallStreaks( vWaterWorldPosition, vWaterSurfaceY )
        );
#ifdef WATER_FALL_SIMPLE
        float mist = 0.0;
#else
        // Round puffs of mist where the sheet thins out, drifting down.
        float mistNoise = waterfallNoise( vec2(
            waterfallAcross( vWaterWorldPosition ) * 3.6,
            vWaterWorldPosition.y * 3.6 + waterfallTimeCells( 1.1 )
        ) );
        float mist = smoothstep( 0.2, 0.45, fade ) *
            ( 1.0 - smoothstep( 0.75, 1.0, fade ) ) *
            smoothstep( 0.5, 0.58, mistNoise );
#endif
        extrasAlbedo = mix( mix( sheet, uWaterFoam, fade * 0.4 ), uWaterFoam, mist * 0.8 );
        extrasAlpha = max( 1.0 - smoothstep( 0.05, 0.6, fade ), mist * 0.7 );
    } else {
        // Foam hugging the foot of the fall, with a scalloped edge, and a
        // thin ring that rolls out from it.
        float fromWall = length( vWaterfallShape.yz );
        float scallop = waterfallNoise( vec2(
            waterfallAcross( vWaterWorldPosition ) * 9.0,
            waterfallTimeCells( 0.4 )
        ) );
        float foamEdge = 0.08 + scallop * 0.05;
        float foam = 1.0 - smoothstep( foamEdge - 0.01, foamEdge + 0.01, fromWall );
#ifdef WATER_FALL_SIMPLE
        float ring = 0.0;
#else
        float ringPhase = fract( uTime * 0.45 );
        float ringAt = 0.09 + ringPhase * 0.1;
        float ring = ( 1.0 - smoothstep( 0.008, 0.02, abs( fromWall - ringAt ) ) ) *
            ( 1.0 - ringPhase );
#endif
        float onTerrain = 1.0 - step( 1.5, vWaterfallShape.x );
        float snowHide = 1.0 - smoothstep( 0.1, 0.45, uWaterfallSnow ) * onTerrain;
        extrasAlbedo = uWaterFoam;
        extrasAlpha = max( foam * 0.95, ring * 0.5 ) *
            smoothstep( 0.0, 1.0, vWaterfallShape.w ) *
            snowHide;
    }
    diffuseColor = vec4( extrasAlbedo, opacity * extrasAlpha );
}
#endif
`;

/**
 * Replaces the material colour with toy water albedo: a clean body in the
 * water role colour, a soft lighter band and a thin light line where it
 * meets a bank, slow broad drift on top and a deeper tone on the sides.
 * The scene lights it, so it follows time of day, weather, moonlight and
 * shadows like every other surface.
 */
const waterFragmentAlbedo = /* glsl */ `
vec4 foamEdges = uFoamEdges;
vec4 foamCorners = uFoamCorners;
#ifdef USE_WATER_FOAM_ATTRIBUTES
    foamEdges = vWaterFoamEdges;
    foamCorners = vWaterFoamCorners;
#endif

// Hide inner walls that face an adjacent water block, so the tiled surface
// stays continuous instead of revealing internal partitions.
if ( uDiscardInnerEdges > 0.5 ) {
    if ( vWaterLocalNormal.x < -0.7 && foamEdges.x < 0.5 ) discard;
    if ( vWaterLocalNormal.x > 0.7 && foamEdges.y < 0.5 ) discard;
    if ( vWaterLocalNormal.z < -0.7 && foamEdges.z < 0.5 ) discard;
    if ( vWaterLocalNormal.z > 0.7 && foamEdges.w < 0.5 ) discard;
}

float waterTopness = clamp( vWaterTopness, 0.0, 1.0 );
vec2 waterUv = vWaterWorldPosition.xz;
float waterColumnDepth = max( vWaterColumnDepth, 0.0 );

// The middle of a large pond and deep pits sit a step deeper. The shore
// distance is per corner, so the ramp is wide and gentle enough that its
// straight interpolation lines never show.
float distanceToBank = resolveWaterBankDistance( vWaterLocalPosition.xz, foamEdges, foamCorners );
float openWater = 0.0;
#ifdef USE_WATER_SHORE_DEPTH_ATTRIBUTE
    openWater = smoothstep( 1.0, 4.0, vWaterShoreDepth );
#endif
float deepness = clamp(
    openWater * 0.4 + smoothstep( 1.4, 3.2, waterColumnDepth ) * 0.3,
    0.0,
    0.6
);
vec3 waterSurface = mix( uWaterShallow, uWaterDeep, deepness );

// Calm drift: two broad, soft patches and a slow light glint. Shapes are
// more than half a tile across, so nothing reads as speckle. The glint mixes
// two turned octaves and fades in gently, so it shows as a soft round sheen.
vec2 flowA = vec2( uTime * 0.05, -uTime * 0.035 );
vec2 flowB = vec2( -uTime * 0.032, uTime * 0.045 );
vec2 driftUvA = waterNoiseTurnA * waterUv;
vec2 driftUvB = waterNoiseTurnB * waterUv;
float patchA = waterNoise( driftUvA * 0.85 + flowA );
float patchB = waterNoise( driftUvB * 1.3 + flowB + vec2( 4.1, -2.7 ) );
float drift = ( patchA - 0.5 ) * 0.1 + ( patchB - 0.5 ) * 0.08;
float glintNoise =
    waterNoise( driftUvB * 1.6 + flowB * 1.6 + vec2( -3.3, 1.9 ) ) * 0.65 +
    waterNoise( driftUvA * 2.9 - flowA * 1.2 + vec2( 2.6, 5.3 ) ) * 0.35;
float glint = smoothstep( 0.6, 0.84, glintNoise );

// Soft lighter edge at the bank, ending in a thin light line that hugs the
// bank. The bank's grass lip covers the first 0.07.
float wobble = waterNoise( driftUvA * 3.1 + vec2( uTime * 0.12, -uTime * 0.09 ) ) - 0.5;
float bankBand = 1.0 - smoothstep( 0.05, 0.34, distanceToBank + wobble * 0.05 );
float bankLine = 1.0 - smoothstep( 0.08, 0.115, distanceToBank + wobble * 0.025 );
vec3 bankAlbedo = mix( uWaterShallow, uWaterFoam, 0.4 );

vec3 topAlbedo = waterSurface * ( 1.0 + drift * ( 1.0 - bankBand ) );
topAlbedo = mix( topAlbedo, uWaterFoam, glint * ${waterGlintStrength.toFixed(3)} * ( 1.0 - bankBand ) );
topAlbedo = mix( topAlbedo, bankAlbedo, bankBand * bankBand * 0.85 );
topAlbedo = mix( topAlbedo, uWaterFoam, bankLine * 0.8 );

// Sides show the body of the water: the side tone, deepening slowly down a
// tall column. The rounded rim and the lights give the edge and the two
// side values; nothing is painted on.
float belowSurface = max( vWaterSurfaceY - vWaterWorldPosition.y, 0.0 );
vec3 sideAlbedo = mix(
    uWaterSide,
    mix( uWaterSide, uWaterDeep, 0.6 ),
    smoothstep( 0.0, 1.6, belowSurface )
);

${waterfallSideAlbedo}
vec3 waterAlbedo = mix( sideAlbedo, topAlbedo, waterTopness );
${waterfallLipAlbedo}

// Swamp water grows broad algae rafts on the exposed top only. Keeping this
// procedural avoids a repeated texture seam between blocks.
vec2 algaeDrift = vec2( uTime * 0.008, -uTime * 0.006 );
float algaeBroad = waterNoise( waterUv * 1.45 + algaeDrift + vec2( 5.2, -3.7 ) );
float algaeDetail = waterNoise( waterUv * 3.2 - algaeDrift * 1.4 + vec2( -1.8, 6.1 ) );
float algaeRafts = smoothstep( 0.56, 0.66, algaeBroad * 0.7 + algaeDetail * 0.3 );
float algae = algaeRafts * uAlgaeStrength * waterTopness * ( 1.0 - bankLine );
waterAlbedo = mix( waterAlbedo, uWaterAlgae, clamp( algae * 0.92, 0.0, 0.92 ) );

// Water is opaque wherever it has a block of depth under it: a water block
// takes the place of the ground block, so a see-through top shows the sky
// beneath the island. Only the shallow end of water over a slope lets the
// bank show through. The material opacity still fades a preview copy.
float topAlpha = mix( 0.6, 1.0, smoothstep( 0.08, 0.6, waterColumnDepth ) );
diffuseColor = vec4( waterAlbedo, opacity * mix( 1.0, topAlpha, waterTopness ) );
${waterfallExtrasAlbedo}
`;

/**
 * Keeps the wet roughness but turns a sun or moon at the mirror angle into a
 * soft sheen. Under the orthographic camera every water top shares one
 * normal, so an uncapped highlight would flash the whole pond white at once.
 */
const waterFragmentSheen = /* glsl */ `
reflectedLight.directSpecular = min(
    reflectedLight.directSpecular,
    vec3( ${waterSurfaceSheenCap.toFixed(4)} )
);
`;

/**
 * Keeps the water shader on copies. The pack layout preview clones every
 * material to fade it, and a plain material copy drops the shader hook and
 * defines, which would turn the water white.
 */
class WaterBlockMaterial extends MeshStandardMaterial {
    override copy(source: MeshStandardMaterial) {
        super.copy(source);
        this.defines = { ...source.defines };
        this.onBeforeCompile = source.onBeforeCompile;
        this.customProgramCacheKey = source.customProgramCacheKey;
        return this;
    }
}

function linearColor([red, green, blue]: LinearRgb) {
    return new Color().setRGB(red, green, blue, LinearSRGBColorSpace);
}

function resolveWaterAlbedo(style: WaterBlockStyle) {
    if (style === 'swamp') {
        return { ...waterAlbedoPalette.swamp, algaeStrength: 1 };
    }

    return {
        ...waterAlbedoPalette.standard,
        algae: waterAlbedoPalette.standard.shallow,
        algaeStrength: 0,
    };
}

/**
 * The waterfall part a material draws: `sides` turns exposed walls into
 * falling sheets (needs the `waterFallFloor` attribute), `lip` foams the
 * rounded lips of a water top, `extras` draws the landing foam, spills
 * and island-edge run-outs (`waterfallExtrasGeometry.ts`).
 */
export type WaterfallMaterialPart = 'extras' | 'lip' | 'sides';

export type WaterBlockMaterialSettings = {
    discardInnerEdges: boolean;
    foamCorners: Vector4;
    foamEdges: Vector4;
    style: WaterBlockStyle;
    /** Scene time in seconds; a still uniform freezes the drift. */
    timeUniform: IUniform<number>;
    useFoamAttributes: boolean;
    useLocalPositionAttribute: boolean;
    useShoreDepthAttribute: boolean;
    useWaterDepthAttribute: boolean;
    waterDepth: number;
    /** Local y of the top face, for meshes without surface attributes. */
    waterTopLocalY: number;
    /** Waterfall part this material draws; none by default. */
    waterfall?: WaterfallMaterialPart;
    /** One noise octave and no foam ring or mist (low quality). */
    waterfallSimple?: boolean;
    /** Snow on flat grass, 0 to 1; landing foam on terrain fades under it. */
    waterfallSnowUniform?: IUniform<number>;
};

/**
 * Lit water material. It is a standard material with wet roughness and no
 * metalness, so the sun, moon, sky fill, shadows, sky rim and surface
 * gradient shade it exactly like the terrain around it. The shader swaps in
 * the water albedo and caps the direct highlight to a sheen.
 */
export function createWaterBlockMaterial({
    discardInnerEdges,
    foamCorners,
    foamEdges,
    style,
    timeUniform,
    useFoamAttributes,
    useLocalPositionAttribute,
    useShoreDepthAttribute,
    useWaterDepthAttribute,
    waterDepth,
    waterTopLocalY,
    waterfall,
    waterfallSimple = false,
    waterfallSnowUniform,
}: WaterBlockMaterialSettings) {
    const albedo = resolveWaterAlbedo(style);
    const uniforms: Record<string, IUniform> = {
        uTime: timeUniform,
        uWaterShallow: { value: linearColor(albedo.shallow) },
        uWaterDeep: { value: linearColor(albedo.deep) },
        uWaterSide: { value: linearColor(albedo.side) },
        uWaterFoam: { value: linearColor(albedo.foam) },
        uWaterAlgae: { value: linearColor(albedo.algae) },
        uAlgaeStrength: { value: albedo.algaeStrength },
        uFoamEdges: { value: foamEdges.clone() },
        uFoamCorners: { value: foamCorners.clone() },
        uDiscardInnerEdges: { value: discardInnerEdges ? 1 : 0 },
        uWaterDepth: { value: waterDepth },
        uWaterTopLocalY: { value: waterTopLocalY },
        uWaterfallSnow: waterfallSnowUniform ?? { value: 0 },
    };
    const extras = waterfall === 'extras';
    // Still in the transparent pass, so the shallow end over a slope can
    // blend, but it writes depth: the water body is opaque and its own
    // far walls must not paint over its near ones. Waterfall extras fade
    // out, so they write no depth and never cut holes in what draws after
    // them (rain, mist, splash rings).
    const waterMaterial = new WaterBlockMaterial({
        depthTest: true,
        depthWrite: !extras,
        metalness: 0,
        roughness: litWaterSurfaceRoughness,
        polygonOffset: true,
        polygonOffsetFactor: extras ? -1 : -0.5,
        polygonOffsetUnits: extras ? -1 : -0.5,
        side: DoubleSide,
        transparent: true,
    });
    // The extras are flat foam and near-flat sheets: one pass is enough, and
    // the back-then-front pass of a double-sided transparent mesh would
    // double their draws.
    waterMaterial.forceSinglePass = extras;
    waterMaterial.defines = {
        ...waterMaterial.defines,
        ...(useFoamAttributes ? { USE_WATER_FOAM_ATTRIBUTES: '' } : {}),
        ...(useLocalPositionAttribute
            ? { USE_WATER_LOCAL_POSITION_ATTRIBUTE: '' }
            : {}),
        ...(useWaterDepthAttribute ? { USE_WATER_DEPTH_ATTRIBUTE: '' } : {}),
        ...(useShoreDepthAttribute
            ? { USE_WATER_SHORE_DEPTH_ATTRIBUTE: '' }
            : {}),
        ...(waterfall === 'sides' ? { USE_WATER_FALL_SIDES: '' } : {}),
        ...(waterfall === 'lip' ? { USE_WATER_FALL_LIP: '' } : {}),
        ...(extras ? { USE_WATER_FALL_EXTRAS: '' } : {}),
        ...(waterfall && waterfallSimple ? { WATER_FALL_SIMPLE: '' } : {}),
    };
    waterMaterial.onBeforeCompile = (shader) =>
        injectWaterBlockShader(shader, uniforms);
    waterMaterial.customProgramCacheKey = () => 'gredice-water-block-v8';
    return waterMaterial;
}

type ShaderSource = {
    fragmentShader: string;
    uniforms: Record<string, IUniform>;
    vertexShader: string;
};

/**
 * Splices the water code into three's standard material shader: the
 * varyings after `common`, the water attributes after `fog_vertex`, the
 * water albedo in place of `color_fragment` and the sheen cap after
 * `lights_fragment_end`, where the shared sky rim and surface gradient have
 * already run.
 */
export function injectWaterBlockShader(
    shader: ShaderSource,
    uniforms: Record<string, IUniform>,
) {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <common>',
            `#include <common>\n${waterVertexDeclarations}`,
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>\n${waterfallExtrasVertex}`,
        )
        .replace(
            '#include <fog_vertex>',
            `#include <fog_vertex>\n${waterVertexMain}`,
        );
    shader.fragmentShader = shader.fragmentShader
        .replace(
            '#include <common>',
            `#include <common>\n${waterFragmentDeclarations}`,
        )
        .replace('#include <color_fragment>', waterFragmentAlbedo)
        .replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>\n${waterFragmentSheen}`,
        );
}
