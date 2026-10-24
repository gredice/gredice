import { useFrame } from '@react-three/fiber';
import { Points } from 'three';

export function StarsDepthProbe() {
    useFrame(({ scene, camera, gl }) => {
        const stars = scene.getObjectByName('Environment:Stars:count:120');
        if (!(stars instanceof Points)) return;
        // Put a star at the center so the test does not depend on the random sky.
        const positions = stars.geometry.getAttribute('position');
        positions.setXYZ(0, 0, 0, -10);
        positions.needsUpdate = true;
        gl.render(scene, camera);
        const context = gl.getContext();
        const pixels = new Uint8Array(
            gl.domElement.width * gl.domElement.height * 4,
        );
        context.readPixels(
            0,
            0,
            gl.domElement.width,
            gl.domElement.height,
            context.RGBA,
            context.UNSIGNED_BYTE,
            pixels,
        );
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] || pixels[i + 1] || pixels[i + 2]) lit += 1;
        }
        gl.domElement.dataset.litPixels = String(lit);
    }, 1);
    return null;
}
