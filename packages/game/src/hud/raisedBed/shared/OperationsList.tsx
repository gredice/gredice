import { OperationData } from "@gredice/client";
import { Button } from "@signalco/ui-primitives/Button";
import { List } from "@signalco/ui-primitives/List";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { KnownPages } from "../../../knownPages";
import { OperationListItemSkeleton } from "../OperationListItemSkeleton";
import { useOperations } from "../../../hooks/useOperations";
import { Alert } from "@signalco/ui/Alert";
import { Stack } from "@signalco/ui-primitives/Stack";
import { usePlantSort } from "../../../hooks/usePlantSorts";
import { useSetShoppingCartItem } from "../../../hooks/useSetShoppingCartItem";
import { useState, useCallback, useRef } from "react"
import { useSprings, config, animated, to, SpringValue } from "@react-spring/web"

interface AnimationOptions {
    duration?: number
    bounceScale?: number
    shrinkScale?: number
}

export function useAnimateFlyTo(targetX: number, targetY: number, options: AnimationOptions = {}) {
    const { duration = 800, bounceScale = 1.2, shrinkScale = 0.3 } = options

    const [animations, setAnimations] = useState<number[]>([]);
    const elementRef = useRef<HTMLDivElement | null>(null)

    const [springs, api] = useSprings(animations.length, (index) => {
        if (!elementRef.current) {
            console.warn("Element reference is not set for animation");
            return {
                from: { x: 0, y: 0, scale: 1, opacity: 1 },
                to: { x: 0, y: 0, scale: 1, opacity: 0 }
            };
        }

        // Get current position accounting for scroll offset and document positioning
        const rect = elementRef.current.getBoundingClientRect()
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft
        const scrollY = window.pageYOffset || document.documentElement.scrollTop

        const startX = rect.left + scrollX + rect.width / 2
        const startY = rect.top + scrollY + rect.height / 2

        return {
            from: {
                x: startX,
                y: startY,
                scale: 1,
                opacity: 1,
            },
            to: async (next) => {
                // await next({
                //     immediate: true,
                //     x: startX,
                //     y: startY,
                //     scale: 1,
                //     opacity: 1
                // });
                await next({
                    x: startX,
                    y: startY - 10,
                    scale: bounceScale,
                    config: { ...config.wobbly, duration: duration },
                });
                // await next({
                //     x: targetX,
                //     y: targetY,
                //     scale: 1,
                //     config: { ...config.gentle, duration: duration * 0.6 },
                // });
                // await next({
                //     x: 0,
                //     y: 0,
                //     scale: shrinkScale,
                //     opacity: 0,
                //     config: { ...config.slow, duration: duration * 0.7 },
                // });

                // Wait for the animation to finish before removing it
                setAnimations(prev => {
                    // Remove the first item (the one that just finished)
                    const newAnimations = [...prev];
                    newAnimations.splice(index, 1);
                    return newAnimations;
                });
            },
        };
    })

    const run = useCallback(async () => {
        setAnimations(prev => [...prev, Date.now()]); // Use timestamp as unique ID
    }, []);

    const reset = useCallback(() => {
        api.stop()
        setAnimations([])
    }, [api])

    return {
        run,
        reset,
        isAnimating: animations.length > 0,
        props: {
            ref: elementRef,
            animations,
            springs,
        },
    }
}

import type React from "react"
import { createPortal } from "react-dom"

interface AnimateFlyToItemProps {
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
    className = "",
    style = {},
    ref,
    animations = [],
    springs = [],
    ...props
}) => {
    return (
        <>
            {/* Original element */}
            <div ref={ref} className={`inline-block ${className}`} style={style} {...props}>
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
                                    className={`absolute inset-0 inline-block pointer-events-none ${className}`}
                                    style={{
                                        transformOrigin: "center center",
                                        willChange: "transform, opacity",
                                        transform:
                                            to(
                                                [spring.x, spring.y, spring.scale],
                                                (x: number, y: number, scale: number) => `translate(${x ?? 0}px, ${y ?? 0}px) scale(${scale ?? 1})`
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

export function OperationsList({
    gardenId,
    raisedBedId,
    positionIndex,
    plantSortId,
    filterFunc
}: {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    plantSortId?: number;
    filterFunc: (operation: OperationData) => boolean;
}) {
    const setShoppingCartItem = useSetShoppingCartItem();
    const { data: operations, isLoading: isLoadingOperations, isError } = useOperations();
    const { data: plantSort, isLoading: isPlantSortLoading } = usePlantSort(plantSortId);
    const isLoading = isLoadingOperations || (Boolean(plantSortId) && isPlantSortLoading);
    const filteredOperations = operations
        ?.filter(filterFunc)
        .filter(op => plantSortId ? plantSort?.information.plant.information?.operations?.map(op => op.information?.name).includes(op.information.name) : true)

    async function handleOperationPicked(operation: OperationData) {
        setShoppingCartItem.mutate({
            amount: 1,
            entityId: operation.id.toString(),
            entityTypeName: operation.entityType.name,
            gardenId,
            raisedBedId,
            positionIndex,
            additionalData: null // TODO: Implement scheduling for operations
        });
        animateFlyToShoppingCart.run();
    }

    const shoppingCartPositionX = window.innerWidth < 768 ? 30 : 20;
    const shoppingCartPositionY = window.innerWidth < 768 ? 90 : 70;
    const animateFlyToShoppingCart = useAnimateFlyTo(shoppingCartPositionX, shoppingCartPositionY);

    return (
        <>
            {isError && (
                <Alert color="danger">
                    Greška prilikom učitavanja radnji
                </Alert>
            )}
            <List variant="outlined" className="bg-card max-h-96 overflow-y-auto">
                {!isLoading && filteredOperations?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema dostupnih radnji
                    </NoDataPlaceholder>
                )}
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                    <OperationListItemSkeleton key={index} />
                ))}
                {filteredOperations?.map((operation) => {
                    const price = operation.prices?.perOperation ? operation.prices.perOperation.toFixed(2) : 'Nepoznato';
                    return (
                        <Stack key={operation.id}>
                            <Button
                                variant="plain"
                                className="justify-start text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal"
                                onClick={() => handleOperationPicked(operation)}>
                                {/* <img
                                    src={'https://www.gredice.com/' + operation.image?.cover?.url}
                                    alt={operation.information.label}
                                    width={48}
                                    height={48}
                                    className="size-12" /> */}
                                <AnimateFlyToItem {...animateFlyToShoppingCart.props}>
                                    <span className="size-8 text-3xl">🪏</span>
                                </AnimateFlyToItem>
                                <Stack className="w-full">
                                    <Row spacing={1} justifyContent="space-between">
                                        <Typography level="body1" semiBold>
                                            {operation.information.label}
                                        </Typography>
                                        <Typography level="body1" semiBold>{price} €</Typography>
                                    </Row>
                                    {operation.information.shortDescription && (
                                        <Typography level="body2" className="line-clamp-2 break-words">
                                            {operation.information.shortDescription}
                                        </Typography>
                                    )}
                                </Stack>
                            </Button>
                            <div className="flex flex-wrap gap-y-1 gap-x-2 px-4 items-center justify-end">
                                <Button
                                    title="Više informacija"
                                    variant="link"
                                    size="sm"
                                    href={KnownPages.GrediceOperation(operation.information.label)}>
                                    Više informacija...
                                </Button>
                            </div>
                        </Stack>
                    );
                })}
            </List>
        </>
    )
}