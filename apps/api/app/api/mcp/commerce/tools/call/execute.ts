import { isOperationApplicableToPlant } from '@gredice/js/operations';
import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    type EntityStandardized,
    getEntitiesFormatted,
    getEntityFormatted,
    getEntityRaw,
    getGarden,
    getOrCreateShoppingCart,
    getRaisedBed,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import { z } from 'zod';
import {
    assertOperationCartTarget,
    resolveOperationCartTarget,
} from '../../../../../../lib/mcp/operationCartTarget';

type McpAuthContext = {
    accountId: string;
    userId: string;
    role: string;
};

type CommerceEntity = EntityStandardized & {
    description?: string;
    name?: string;
};

type PlantEntity = EntityStandardized & {
    information?: EntityStandardized['information'] & {
        operations?: Array<{
            information?: { name?: string };
        }>;
    };
};

type PlantSortEntity = EntityStandardized & {
    information?: EntityStandardized['information'] & {
        plant?: PlantEntity | null;
    };
};

const GetProductsSchema = z.object({
    query: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).default(0),
});

const GetCartSchema = z.object({
    userId: z.string().optional(),
});

const AddToCartSchema = z.object({
    userId: z.string().optional(),
    productId: z.string().min(1),
    quantity: z.number().positive().default(1),
    gardenId: z.number().int().positive().optional(),
    raisedBedId: z.number().int().positive().optional(),
    positionIndex: z.number().int().min(0).optional(),
    scheduledDate: z.string().optional(),
});

const AddOperationToCartSchema = z.object({
    userId: z.string().optional(),
    operationId: z.coerce.number().int().positive(),
    quantity: z.number().positive().default(1),
    gardenId: z.number().int().positive().optional(),
    raisedBedId: z.number().int().positive().optional(),
    positionIndex: z.number().int().min(0).optional(),
    scheduledDate: z.string().optional(),
});

const UpdateCartItemSchema = z.object({
    userId: z.string().optional(),
    cartItemId: z.coerce.number().int().positive(),
    quantity: z.number().min(0),
});

function assertUser(inputUserId: string | undefined, auth: McpAuthContext) {
    if (inputUserId && inputUserId !== auth.userId) {
        throw new Error('Cart user does not match authenticated user');
    }
}

function requireCommerceAuth(auth: McpAuthContext | null) {
    if (!auth) {
        throw new Error('Cart tools require authentication');
    }

    return auth;
}

function productEntityId(productId: string) {
    const normalized = productId.replace(/^plant-sort-/, '');
    const entityId = Number(normalized);
    return Number.isInteger(entityId) && entityId > 0 ? entityId : null;
}

function productName(product: CommerceEntity) {
    return (
        product.information?.name ??
        product.information?.label ??
        product.name ??
        `Proizvod #${product.id.toString()}`
    );
}

function formatProduct(product: CommerceEntity) {
    const plant = product.information?.plant as CommerceEntity | undefined;
    return {
        id: `plant-sort-${product.id.toString()}`,
        entityId: product.id,
        entityTypeName: product.entityType?.name ?? 'plantSort',
        name: productName(product),
        plantName: plant ? productName(plant) : undefined,
        description:
            product.information?.shortDescription ?? product.description ?? '',
        price: {
            amount: product.prices?.perPlant ?? 0,
            currency: 'EUR',
        },
        imageUrl: product.images?.cover?.url ?? null,
    };
}

async function listProducts(input: z.infer<typeof GetProductsSchema>) {
    const products =
        (await getEntitiesFormatted<CommerceEntity>('plantSort')) ?? [];
    const query = input.query?.trim().toLowerCase();
    const filtered = query
        ? products.filter((product) =>
              [
                  productName(product),
                  product.information?.shortDescription,
                  product.description,
              ]
                  .filter((value): value is string => typeof value === 'string')
                  .some((value) => value.toLowerCase().includes(query)),
          )
        : products;

    return {
        items: filtered
            .slice(input.offset, input.offset + input.limit)
            .map(formatProduct),
        total: filtered.length,
        limit: input.limit,
        offset: input.offset,
    };
}

function formatCart(
    cart: NonNullable<Awaited<ReturnType<typeof getOrCreateShoppingCart>>>,
) {
    return {
        id: cart.id,
        status: cart.status,
        items: cart.items.map((item) => ({
            id: item.id,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            amount: item.amount,
            gardenId: item.gardenId,
            raisedBedId: item.raisedBedId,
            positionIndex: item.positionIndex,
            additionalData: item.additionalData,
            status: item.status,
            createdAt: item.createdAt,
        })),
    };
}

async function validateCartLocation({
    accountId,
    gardenId,
    positionIndex,
    raisedBedId,
}: {
    accountId: string;
    gardenId?: number | null;
    positionIndex?: number | null;
    raisedBedId?: number | null;
}) {
    if (gardenId) {
        const garden = await getGarden(gardenId);
        if (!garden || garden.accountId !== accountId) {
            throw new Error('Garden not found for authenticated account');
        }
    }

    if (!raisedBedId) {
        return {
            gardenId: gardenId ?? undefined,
            raisedBed: undefined,
            raisedBedId: undefined,
            positionIndex: positionIndex ?? undefined,
        };
    }

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed || raisedBed.accountId !== accountId) {
        throw new Error('Raised bed not found for authenticated account');
    }

    const finalGardenId = raisedBed.gardenId;
    if (!finalGardenId) {
        throw new Error('Raised bed is not assigned to a garden');
    }

    if (gardenId && finalGardenId !== gardenId) {
        throw new Error('Raised bed does not belong to the provided garden');
    }

    if (!gardenId) {
        const garden = await getGarden(finalGardenId);
        if (!garden || garden.accountId !== accountId) {
            throw new Error('Garden not found for authenticated account');
        }
    }

    if (isRaisedBedAbandoned(raisedBed.status)) {
        throw new Error(
            `${RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE} ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`,
        );
    }

    if (
        typeof positionIndex === 'number' &&
        !raisedBed.fields.some((field) => field.positionIndex === positionIndex)
    ) {
        throw new Error('Raised bed field not found');
    }

    return {
        gardenId: finalGardenId,
        raisedBed,
        raisedBedId: raisedBed.id,
        positionIndex: positionIndex ?? undefined,
    };
}

function linkedOperationNames(plantSort: PlantSortEntity) {
    return new Set(
        plantSort.information?.plant?.information?.operations
            ?.map((operation) => operation.information?.name)
            .filter((name): name is string => Boolean(name)) ?? [],
    );
}

async function validateOperationTarget({
    operation,
    positionIndex,
    raisedBed,
}: {
    operation: CommerceEntity;
    positionIndex?: number;
    raisedBed: NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>;
}) {
    const application = operation.attributes?.application;
    assertOperationCartTarget(application, {
        raisedBedId: raisedBed.id,
        positionIndex,
    });

    if (application !== 'plant') {
        return;
    }

    const field = raisedBed.fields.find(
        (candidate) => candidate.positionIndex === positionIndex,
    );
    if (!field?.plantSortId) {
        throw new Error('Raised-bed field does not contain a plant');
    }

    const plantSort = await getEntityFormatted<PlantSortEntity>(
        field.plantSortId,
    );
    const operationName = operation.information?.name;
    if (!plantSort || !operationName) {
        throw new Error('Plant operation applicability could not be verified');
    }

    const applicable = isOperationApplicableToPlant(
        {
            attributes: {
                application,
                appliesToAllTargets:
                    operation.attributes?.appliesToAllTargets === true,
            },
            information: { name: operationName },
        },
        linkedOperationNames(plantSort),
    );
    if (!applicable) {
        throw new Error(
            'Operation is not applicable to the plant in this field',
        );
    }
}

export async function executeCommerceTool(
    name: string,
    args: unknown,
    auth: McpAuthContext | null,
) {
    switch (name) {
        case 'commerce/get-products':
        case 'commerce/search-products': {
            return listProducts(GetProductsSchema.parse(args ?? {}));
        }
        case 'commerce/get-product': {
            const input = z.object({ productId: z.string() }).parse(args);
            const entityId = productEntityId(input.productId);
            if (!entityId) {
                throw new Error('Unsupported product id');
            }
            const raw = await getEntityRaw(entityId);
            if (
                raw?.state !== 'published' ||
                raw.entityType?.name !== 'plantSort'
            ) {
                throw new Error('Product not found');
            }
            const product = await getEntityFormatted<CommerceEntity>(entityId);
            if (!product) {
                throw new Error('Product not found');
            }
            return formatProduct(product);
        }
        case 'commerce/get-cart': {
            const authContext = requireCommerceAuth(auth);
            const input = GetCartSchema.parse(args ?? {});
            assertUser(input.userId, authContext);
            const cart = await getOrCreateShoppingCart(authContext.accountId);
            return cart ? formatCart(cart) : null;
        }
        case 'commerce/add-to-cart': {
            const authContext = requireCommerceAuth(auth);
            const input = AddToCartSchema.parse(args);
            assertUser(input.userId, authContext);
            const entityId = productEntityId(input.productId);
            if (!entityId) {
                throw new Error('Unsupported product id');
            }
            const product = await getEntityRaw(entityId);
            if (
                product?.state !== 'published' ||
                product.entityType?.name !== 'plantSort'
            ) {
                throw new Error('Product not found');
            }
            const cart = await getOrCreateShoppingCart(authContext.accountId);
            if (!cart) {
                throw new Error('Cart could not be created');
            }
            const location = await validateCartLocation({
                accountId: authContext.accountId,
                gardenId: input.gardenId,
                raisedBedId: input.raisedBedId,
                positionIndex: input.positionIndex,
            });
            const additionalData = input.scheduledDate
                ? JSON.stringify({ scheduledDate: input.scheduledDate })
                : null;
            const cartItemId = await upsertOrRemoveCartItem(
                null,
                cart.id,
                entityId.toString(),
                'plantSort',
                input.quantity,
                location.gardenId,
                location.raisedBedId,
                location.positionIndex,
                additionalData,
            );
            const refreshedCart = await getOrCreateShoppingCart(
                authContext.accountId,
            );
            if (!refreshedCart) {
                throw new Error('Cart could not be loaded');
            }
            return {
                cartItemId,
                cart: formatCart(refreshedCart),
            };
        }
        case 'commerce/add-operation-to-cart': {
            const authContext = requireCommerceAuth(auth);
            const input = AddOperationToCartSchema.parse(args);
            assertUser(input.userId, authContext);
            const operationRaw = await getEntityRaw(input.operationId);
            if (
                operationRaw?.state !== 'published' ||
                operationRaw.entityType?.name !== 'operation'
            ) {
                throw new Error('Operation not found');
            }
            const operation = await getEntityFormatted<CommerceEntity>(
                input.operationId,
            );
            if (!operation) {
                throw new Error('Operation not found');
            }
            const operationTarget = resolveOperationCartTarget(
                operation.attributes?.application,
                {
                    raisedBedId: input.raisedBedId,
                    positionIndex: input.positionIndex,
                },
            );
            const location = await validateCartLocation({
                accountId: authContext.accountId,
                gardenId: input.gardenId,
                raisedBedId: operationTarget.raisedBedId,
                positionIndex: operationTarget.positionIndex,
            });
            if (!location.raisedBedId || !location.raisedBed) {
                throw new Error('Operation requires a raised bed');
            }
            await validateOperationTarget({
                operation,
                positionIndex: location.positionIndex,
                raisedBed: location.raisedBed,
            });
            const cart = await getOrCreateShoppingCart(authContext.accountId);
            if (!cart) {
                throw new Error('Cart could not be created');
            }
            const additionalData = input.scheduledDate
                ? JSON.stringify({ scheduledDate: input.scheduledDate })
                : null;
            const cartItemId = await upsertOrRemoveCartItem(
                null,
                cart.id,
                input.operationId.toString(),
                'operation',
                input.quantity,
                location.gardenId,
                location.raisedBedId,
                location.positionIndex,
                additionalData,
            );
            const refreshedCart = await getOrCreateShoppingCart(
                authContext.accountId,
            );
            if (!refreshedCart) {
                throw new Error('Cart could not be loaded');
            }
            return {
                cartItemId,
                cart: formatCart(refreshedCart),
            };
        }
        case 'commerce/update-cart-item': {
            const authContext = requireCommerceAuth(auth);
            const input = UpdateCartItemSchema.parse(args);
            assertUser(input.userId, authContext);
            const cart = await getOrCreateShoppingCart(authContext.accountId);
            if (!cart) {
                throw new Error('Cart not found');
            }
            const item = cart.items.find(
                (candidate) => candidate.id === input.cartItemId,
            );
            if (!item) {
                throw new Error('Cart item not found');
            }
            const location =
                input.quantity > 0
                    ? await validateCartLocation({
                          accountId: authContext.accountId,
                          gardenId: item.gardenId,
                          raisedBedId: item.raisedBedId,
                          positionIndex: item.positionIndex,
                      })
                    : {
                          gardenId: item.gardenId ?? undefined,
                          raisedBedId: item.raisedBedId ?? undefined,
                          positionIndex: item.positionIndex ?? undefined,
                      };
            const cartItemId = await upsertOrRemoveCartItem(
                item.id,
                cart.id,
                item.entityId,
                item.entityTypeName,
                input.quantity,
                location.gardenId,
                location.raisedBedId,
                location.positionIndex,
                item.additionalData,
            );
            const refreshedCart = await getOrCreateShoppingCart(
                authContext.accountId,
            );
            if (!refreshedCart) {
                throw new Error('Cart could not be loaded');
            }
            return {
                cartItemId,
                cart: formatCart(refreshedCart),
            };
        }
        default:
            throw new Error(`Method not found: ${name}`);
    }
}
