import { Color, ShaderMaterial, Vector2 } from 'three';
import { boltTuckShare } from './boltPlacement';

/**
 * Share of the bolt's height below the deck's lip over which it fades in:
 * the part tucked into the deck (`boltTuckShare`) stays hidden under the
 * deck's translucent lip and the bolt melts out of it, instead of showing
 * a flat, pale top through it.
 */
export const boltRootFadeShare = 0.2;

/**
 * The bolt's unlit two-tone material (GAME_ART.md "Weather > Colour roles":
 * bolt face, side and light are the sunflower petal roles). It writes the
 * role colours exactly at every time of day and takes no scene light or
 * fog. The bolt grows down from its root and pulls back up from its tip by
 * discarding along its height, so a strike needs no geometry change.
 */
export function createBoltMaterial(span: { minY: number; maxY: number }) {
    return new ShaderMaterial({
        name: 'Weather:LightningBoltMaterial',
        transparent: true,
        depthWrite: false,
        depthTest: true,
        fog: false,
        toneMapped: false,
        uniforms: {
            uFace: { value: new Color('#ffd31c') },
            uSide: { value: new Color('#ffb300') },
            uLight: { value: new Color('#fff3a6') },
            uOpacity: { value: 0 },
            uReveal: { value: 1 },
            uRetract: { value: 0 },
            uSpan: { value: new Vector2(span.minY, span.maxY) },
        },
        vertexShader: /* glsl */ `
            uniform vec2 uSpan;
            varying vec3 vViewNormal;
            varying float vHeight;
            varying float vFromTop;
            void main() {
                vViewNormal = normalize(normalMatrix * normal);
                vHeight = position.y;
                vFromTop = (uSpan.y - position.y) / max(uSpan.y - uSpan.x, 1e-4);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uFace;
            uniform vec3 uSide;
            uniform vec3 uLight;
            uniform float uOpacity;
            uniform float uReveal;
            uniform float uRetract;
            varying vec3 vViewNormal;
            varying float vHeight;
            varying float vFromTop;
            void main() {
                // Grows from the cloud (top) down; retracts from the tip up.
                if (vFromTop > uReveal || vFromTop > 1.0 - uRetract) discard;
                vec3 n = normalize(vViewNormal);
                float front = smoothstep(0.35, 0.9, n.z);
                vec3 color = mix(uSide, uFace, front);
                color = mix(
                    color,
                    uLight,
                    front * 0.55 * smoothstep(-0.4, 1.0, vHeight) +
                        0.35 * smoothstep(0.2, 0.9, -n.x + n.y)
                );
                float rootFade = smoothstep(
                    ${boltTuckShare.toFixed(3)},
                    ${(boltTuckShare + boltRootFadeShare).toFixed(3)},
                    vFromTop
                );
                gl_FragColor = vec4(color, uOpacity * rootFade);
                #include <colorspace_fragment>
            }
        `,
    });
}
