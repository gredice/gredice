import { useSpring } from '@react-spring/three';

export function useAnimatedEntityRotation(rotation: number) {
    const { rotation: sprintRotation } = useSpring({
        config: {
            mass: 0.1,
            tension: 200,
            friction: 10,
        },
        rotation: [0, rotation * (Math.PI / 2), 0],
    });

    return [sprintRotation];
}
