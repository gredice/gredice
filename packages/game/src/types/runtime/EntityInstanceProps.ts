import type { Block } from "../Block"
import type { Stack } from "../Stack"

export type EntityInstanceProps = {
    stack: Stack,
    block: Block,
    rotation: number
    variant?: number | null
}