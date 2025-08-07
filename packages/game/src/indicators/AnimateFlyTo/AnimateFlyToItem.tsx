
import type React from "react"
import { createPortal } from "react-dom"
import { cx } from "@signalco/ui-primitives/cx";
import { animated, SpringValue, to } from "@react-spring/web";

export type AnimateFlyToItemProps = {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
    ref?: React.Ref<HTMLDivElement>
    animations?: Array<number>,
    springs?: Array<{
        x: SpringValue<number>
        y: SpringValue<number>
        scale: SpringValue<number>
        opacity: SpringValue<number>
    }>
}

export const AnimateFlyToItem: React.FC<AnimateFlyToItemProps> = ({
    children,
    className,
    style,
    ref,
    animations = [],
    springs = [],
    ...props
}) => {
    return (
        <>
            {/* Original element */}
            <div ref={ref} className={cx('inline-block', className)} style={style} {...props}>
                {children}
            </div>

            {/* Render animated elements in portal to document.body */}
            {typeof document !== "undefined" &&
                createPortal(
                    <>
                        {animations.map((animationId, index) => {
                            const spring = springs[index]
                            if (!spring) return null;

                            return (
                                <animated.div
                                    key={animationId}
                                    className={cx('absolute left-0 top-0 inline-block pointer-events-none', className)}
                                    style={{
                                        willChange: "transform, opacity",
                                        transform:
                                            to(
                                                [spring.x, spring.y, spring.scale],
                                                (x, y, scale) => `translate(${x ?? 0}px, ${y ?? 0}px) scale(${scale ?? 1})`
                                            ),
                                        opacity: spring.opacity ?? 1,
                                        zIndex: 1000,
                                        ...style,
                                    }}
                                >
                                    {children}
                                </animated.div>
                            )
                        })}
                    </>,
                    document.body
                )}
        </>
    )
}
