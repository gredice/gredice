import { useMemo, useRef } from 'react'
import { Vector3, Mesh } from 'three'
import { useFrame } from '@react-three/fiber'
import vertority from './vertority';
import { getCoord } from './scene';
import { inRange } from './random';
import { computeBoundingbox } from './element';
import { DIRS } from './constants';
import { SpringValue } from '@react-spring/three';
import { animated } from '@react-spring/three'

export type Snowflake = {
    startpoint: Vector3
    radius: number
}

export type UseSnowflakesProps = {
    count?: number
}

export const useSnowflakes = ({ count = 500 }: UseSnowflakesProps = { count: 500 }) => {
    const snowflakes = useMemo(() => {
        const coord = getCoord()
        return new Array(4).fill(0).reduce((prev, _cur, i) => {
            return prev.concat(
                new Array(Math.round(count / 4)).fill(0).map(() => {
                    const vertor = vertority.fromPlacement('fromTop')
                    return {
                        startpoint: new Vector3().copy(new Vector3(0, coord[1] + i * 2, Math.random() * 20 - 10)).add(vertor),
                        radius: Math.random() * 0.1,
                    }
                }),
            )
        }, [])
    }, [count])
    return {
        snowflakes: snowflakes as Snowflake[],
    }
}

type UseSnowflakeProps = {
    value: Snowflake
}

export const useSnowflake = (
    flake: React.RefObject<Mesh | undefined>,
    { value }: UseSnowflakeProps,
) => {
    const vy0 = useRef(0.01)
    const coord = useRef(getCoord()).current
    // vy0 / vx0 = tan(angle)
    const vx0 = useRef(0.001 * Math.random() * inRange(DIRS))
    // const a = useRef(0.00001)
    const { offsetTop } = computeBoundingbox(value.startpoint)
    useFrame(() => {
        if (!flake.current) {
            return
        }
        // 雪花加速下落
        flake.current.position.y -= vy0.current
        flake.current.position.x -= vx0.current
        // 判断是否出了边界
        if (offsetTop + Math.abs(value.startpoint.y - flake.current.position.y) > coord[1] * 2) {
            const vertor = vertority.fromAxis('fromTop')
            // 随机raindrop初始位置, 避免loop重复
            flake.current.position.set(vertor.x, coord[1], Math.random() * 20 - 10)
            vy0.current = 0.01
            vx0.current = 0.001 * Math.random() * inRange(DIRS)
        }
    })
}

export type Style = {
    opacity: SpringValue<number>
    scale: SpringValue<number[]>
}

type SnowFlakeProps = {
    value: Snowflake
    style?: Style
}

const SnowFlake = ({ value, style }: SnowFlakeProps) => {
    const flake = useRef<Mesh>(undefined)
    useSnowflake(flake, { value })
    return (
        /* @ts-ignore */
        <animated.mesh position={value.startpoint} ref={flake} material-opacity={style?.opacity}>
            <circleGeometry attach="geometry" args={[value.radius, 64]} />
            <meshBasicMaterial color="white" transparent={true} attach="material" />
            {/* @ts-ignore */}
        </animated.mesh>
    )
}

type SnowProps = UseSnowflakesProps & {
    style?: Style
}

export const Snow = (props: SnowProps) => {
    const { snowflakes } = useSnowflakes(props)
    return (
        /* @ts-ignore */
        <animated.group>
            {snowflakes.map((snowflake, index) => {
                return <SnowFlake key={index} value={snowflake} style={props.style} />
            })}
            {/* @ts-ignore */}
        </animated.group>
    )
}

