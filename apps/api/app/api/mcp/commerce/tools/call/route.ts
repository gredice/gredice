import {
    type EntityStandardized,
    getEntitiesFormatted,
    getEntityFormatted,
    getEntityRaw,
    getOrCreateShoppingCart,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    checkMCPPermission,
    createMCPAuthError,
    extractMCPAuth,
    type MCPAuth,
} from '../../../auth';
import { Logger } from '../../../logger';

export const dynamic = 'force-dynamic';

// Input schemas for commerce tools
const GetProductsSchema = z.object({
    category: z
        .enum(['seeds', 'tools', 'fertilizers', 'containers', 'books'])
        .optional(),
    plantType: z.string().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    inStock: z.boolean().default(true),
    locale: z.enum(['hr', 'en']).default('hr'),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
});

const GetProductSchema = z.object({
    productId: z.string(),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const SearchProductsSchema = z.object({
    query: z.string().min(1),
    category: z
        .enum(['seeds', 'tools', 'fertilizers', 'containers', 'books'])
        .optional(),
    locale: z.enum(['hr', 'en']).default('hr'),
    limit: z.number().min(1).max(50).default(10),
});

const GetCartSchema = z.object({
    userId: z.string(),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const AddToCartSchema = z.object({
    userId: z.string(),
    productId: z.string(),
    quantity: z.number().positive().default(1),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const UpdateCartItemSchema = z.object({
    userId: z.string(),
    cartItemId: z.coerce.number().int().positive(),
    quantity: z.number().min(0), // 0 to remove item
    locale: z.enum(['hr', 'en']).default('hr'),
});

type CommerceEntity = EntityStandardized & {
    category?: { name?: string };
    description?: string;
    information?: EntityStandardized['information'] & {
        plant?: CommerceEntity;
    };
    name?: string;
};

type ShoppingCart = NonNullable<
    Awaited<ReturnType<typeof getOrCreateShoppingCart>>
>;
type ShoppingCartItem = ShoppingCart['items'][number];

type FormattedCartItem = {
    id: number;
    productId: string;
    productName: string;
    productImage: string;
    price: {
        amount: number;
        currency: 'EUR';
    };
    quantity: number;
    totalPrice: {
        amount: number;
        currency: 'EUR';
    };
    addedAt: string;
};

function formatCartItem(item: ShoppingCartItem): FormattedCartItem {
    const priceAmount = 0;

    return {
        id: item.id,
        productId: item.entityId,
        productName: item.entityId,
        productImage: 'https://images.gredice.com/products/default.jpg',
        price: {
            amount: priceAmount,
            currency: 'EUR',
        },
        quantity: item.amount,
        totalPrice: {
            amount: priceAmount * item.amount,
            currency: 'EUR',
        },
        addedAt: item.createdAt.toISOString(),
    };
}

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'gredice-mcp-commerce',
        availableTools: [
            'commerce/get-products',
            'commerce/get-product',
            'commerce/search-products',
            'commerce/get-cart',
            'commerce/add-to-cart',
            'commerce/update-cart-item',
        ],
    });
}

export async function POST(request: NextRequest) {
    const logger = new Logger();
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();

    try {
        // Extract and validate authentication
        const auth = await extractMCPAuth(request);

        if (!auth) {
            return NextResponse.json(
                createMCPAuthError(null, 'unauthorized', correlationId),
                { status: 401 },
            );
        }

        // Check basic commerce permission
        if (!checkMCPPermission(auth, 'commerce:read')) {
            return NextResponse.json(
                createMCPAuthError(auth, 'forbidden', correlationId),
                { status: 403 },
            );
        }

        const body = await request.json();
        const { name, arguments: args } = body.params || {};
        const writeTools = new Set([
            'commerce/add-to-cart',
            'commerce/update-cart-item',
        ]);

        if (
            writeTools.has(name) &&
            !checkMCPPermission(auth, 'commerce:purchase')
        ) {
            return NextResponse.json(
                createMCPAuthError(auth, 'forbidden', correlationId),
                { status: 403 },
            );
        }

        logger.info('mcp.commerce.tool.start', {
            toolName: name,
            userId: auth.userId,
            accountId: auth.accountId,
            correlationId,
            timestamp: new Date().toISOString(),
        });

        let result: unknown;

        // Route to appropriate handler based on tool name
        switch (name) {
            case 'commerce/get-products': {
                const getProductsInput = GetProductsSchema.parse(args);
                result = await handleGetProducts(getProductsInput, auth);
                break;
            }

            case 'commerce/get-product': {
                const getProductInput = GetProductSchema.parse(args);
                result = await handleGetProduct(getProductInput, auth);
                break;
            }

            case 'commerce/search-products': {
                const searchProductsInput = SearchProductsSchema.parse(args);
                result = await handleSearchProducts(searchProductsInput, auth);
                break;
            }

            case 'commerce/get-cart': {
                const getCartInput = GetCartSchema.parse(args);
                if (getCartInput.userId !== auth.userId) {
                    return NextResponse.json(
                        createMCPAuthError(auth, 'forbidden', correlationId),
                        { status: 403 },
                    );
                }
                result = await handleGetCart(getCartInput, auth);
                break;
            }

            case 'commerce/add-to-cart': {
                const addToCartInput = AddToCartSchema.parse(args);
                if (addToCartInput.userId !== auth.userId) {
                    return NextResponse.json(
                        createMCPAuthError(auth, 'forbidden', correlationId),
                        { status: 403 },
                    );
                }
                result = await handleAddToCart(addToCartInput, auth);
                break;
            }

            case 'commerce/update-cart-item': {
                const updateCartInput = UpdateCartItemSchema.parse(args);
                if (updateCartInput.userId !== auth.userId) {
                    return NextResponse.json(
                        createMCPAuthError(auth, 'forbidden', correlationId),
                        { status: 403 },
                    );
                }
                result = await handleUpdateCartItem(updateCartInput, auth);
                break;
            }

            default:
                return NextResponse.json(
                    {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: `Method not found: ${name}`,
                        },
                        id: null,
                    },
                    { status: 400 },
                );
        }

        const duration = Date.now() - startTime;
        logger.info('mcp.commerce.tool.success', {
            toolName: name,
            correlationId,
            duration,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json({
            jsonrpc: '2.0',
            result,
            id: body.id || null,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        const statusCode = error instanceof z.ZodError ? 400 : 500;

        logger.error('mcp.commerce.tool.error', {
            correlationId,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: error instanceof z.ZodError ? -32602 : -32603,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Tool execution failed',
                    data:
                        error instanceof z.ZodError ? error.issues : undefined,
                },
                id: null,
            },
            { status: statusCode },
        );
    }
}

// Tool handlers with real database integration
async function handleGetProducts(
    input: z.infer<typeof GetProductsSchema>,
    _auth: MCPAuth,
) {
    try {
        // Get real plant sort data from database as products
        const plantSorts =
            await getEntitiesFormatted<CommerceEntity>('plantSort');

        if (!plantSorts) {
            throw new Error('Failed to fetch plant sorts');
        }

        // Transform plant sorts to commerce product format
        const products = plantSorts.map((plantSort) => {
            const plantInfo = plantSort.information?.plant;
            const name = plantInfo?.information?.name || plantSort.name;
            const description =
                plantInfo?.information?.description || plantSort.description;

            return {
                id: `plant-sort-${plantSort.id}`,
                category: 'seeds',
                name: `Sjeme - ${name}`,
                description:
                    description ||
                    `Kvalitetno sjeme biljke ${name} za uzgoj u vrtu.`,
                plantType: name?.toLowerCase(),
                price: {
                    amount: plantSort.prices?.perPlant || 12.99,
                    currency: 'EUR',
                },
                inStock: true,
                stockQuantity: 0,
                supplier: 'Gredice Seeds',
                properties: {
                    packetSize: '25 sjemenki',
                    germinationRate: '90%',
                    organicCertified: true,
                    variety:
                        plantSort.information?.plant?.attributes?.variety ||
                        'Standard',
                    seedingDistance:
                        plantSort.information?.plant?.attributes
                            ?.seedingDistance,
                    harvestTime:
                        plantSort.information?.plant?.attributes?.harvestTime,
                },
                images: plantSort.images?.cover?.url
                    ? [plantSort.images.cover.url]
                    : ['https://images.gredice.com/products/seeds-generic.jpg'],
                tags: [
                    'sjeme',
                    'biljka',
                    plantSort.information?.plant?.category?.name,
                ].filter(Boolean),
                locale: input.locale,
            };
        });

        // Apply filters
        let filteredProducts = products;

        // Filter by category if provided
        if (input.category) {
            filteredProducts = filteredProducts.filter(
                (p) => p.category === input.category,
            );
        }

        // Filter by plant type if provided
        if (input.plantType) {
            const plantType = input.plantType.toLowerCase();
            filteredProducts = filteredProducts.filter((p) =>
                p.plantType?.toLowerCase().includes(plantType),
            );
        }

        // Filter by price range
        if (input.minPrice !== undefined) {
            const minPrice = input.minPrice;
            filteredProducts = filteredProducts.filter(
                (p) => p.price.amount >= minPrice,
            );
        }

        if (input.maxPrice !== undefined) {
            const maxPrice = input.maxPrice;
            filteredProducts = filteredProducts.filter(
                (p) => p.price.amount <= maxPrice,
            );
        }

        // Filter by stock availability
        if (input.inStock) {
            filteredProducts = filteredProducts.filter((p) => p.inStock);
        }

        // Apply pagination
        const total = filteredProducts.length;
        const paginatedProducts = filteredProducts.slice(
            input.offset,
            input.offset + input.limit,
        );

        return {
            products: paginatedProducts,
            total,
            limit: input.limit,
            offset: input.offset,
            filters: {
                category: input.category,
                plantType: input.plantType,
                priceRange: { min: input.minPrice, max: input.maxPrice },
                inStockOnly: input.inStock,
            },
            locale: input.locale,
        };
    } catch (error) {
        console.error('Error fetching products:', error);
        return {
            products: [],
            total: 0,
            limit: input.limit,
            offset: input.offset,
            error:
                input.locale === 'hr'
                    ? 'Greška pri dohvaćanju proizvoda'
                    : 'Error fetching products',
            locale: input.locale,
        };
    }
}

async function handleGetProduct(
    input: z.infer<typeof GetProductSchema>,
    _auth: MCPAuth,
) {
    const entityId = Number(input.productId.replace('plant-sort-', ''));

    if (!Number.isInteger(entityId) || entityId <= 0) {
        return {
            unsupported: true,
            reason:
                input.locale === 'hr'
                    ? 'Nepodržani identifikator proizvoda'
                    : 'Unsupported product identifier',
            productId: input.productId,
        };
    }

    const rawProduct = await getEntityRaw(entityId);

    if (
        rawProduct?.state !== 'published' ||
        rawProduct.entityType?.name !== 'plantSort'
    ) {
        return {
            unsupported: true,
            reason:
                input.locale === 'hr'
                    ? 'Proizvod nije pronađen u katalogu'
                    : 'Product not found in catalog',
            productId: input.productId,
        };
    }

    const product = await getEntityFormatted<CommerceEntity>(entityId);

    if (!product || product.entityType?.name !== 'plantSort') {
        return {
            unsupported: true,
            reason:
                input.locale === 'hr'
                    ? 'Proizvod nije pronađen u katalogu'
                    : 'Product not found in catalog',
            productId: input.productId,
        };
    }

    const plantInfo = product.information?.plant;
    const name = plantInfo?.information?.name || product.name;

    return {
        id: `plant-sort-${product.id}`,
        category: 'seeds',
        name: `Sjeme - ${name}`,
        description: plantInfo?.information?.description || product.description,
        price: { amount: product.prices?.perPlant || 0, currency: 'EUR' },
        images: product.images?.cover?.url ? [product.images.cover.url] : [],
        locale: input.locale,
    };
}

async function handleSearchProducts(
    input: z.infer<typeof SearchProductsSchema>,
    auth: MCPAuth,
) {
    const products = await handleGetProducts(
        {
            inStock: true,
            limit: 100,
            offset: 0,
            locale: input.locale,
            category: input.category,
            plantType: undefined,
            minPrice: undefined,
            maxPrice: undefined,
        },
        auth,
    );

    const query = input.query.toLowerCase();
    const results = products.products
        .filter((p) =>
            [p.name, p.description, p.plantType]
                .filter((field): field is string => typeof field === 'string')
                .some((field) => field.toLowerCase().includes(query)),
        )
        .slice(0, input.limit);

    return {
        results,
        total: results.length,
        query: input.query,
        category: input.category,
        limit: input.limit,
        locale: input.locale,
    };
}

async function handleGetCart(
    input: z.infer<typeof GetCartSchema>,
    auth: MCPAuth,
) {
    try {
        // Get or create shopping cart for the user
        const cart = await getOrCreateShoppingCart(auth.accountId);

        if (!cart) {
            throw new Error('Failed to get or create cart');
        }

        // Transform cart to expected format
        const formattedCart = {
            id: cart.id,
            userId: auth.userId,
            accountId: auth.accountId,
            items: cart.items.map(formatCartItem),
        };

        const totalAmount = formattedCart.items.reduce(
            (sum, item) => sum + item.totalPrice.amount,
            0,
        );

        return {
            cart: {
                ...formattedCart,
                totalAmount: { amount: totalAmount, currency: 'EUR' },
                totalItems: formattedCart.items.reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                ),
            },
            message:
                input.locale === 'hr'
                    ? 'Košarica uspješno dohvaćena'
                    : 'Cart retrieved successfully',
            locale: input.locale,
        };
    } catch (error) {
        console.error('Error fetching cart:', error);
        return {
            cart: {
                id: `cart-${input.userId}`,
                userId: input.userId,
                items: [],
                totalAmount: { amount: 0, currency: 'EUR' },
                totalItems: 0,
            },
            error:
                input.locale === 'hr'
                    ? 'Greška pri dohvaćanju košarice'
                    : 'Error fetching cart',
            locale: input.locale,
        };
    }
}

async function handleAddToCart(
    input: z.infer<typeof AddToCartSchema>,
    auth: MCPAuth,
) {
    try {
        // First get or create shopping cart for the user
        const cart = await getOrCreateShoppingCart(auth.accountId);
        if (!cart) {
            throw new Error('Failed to get or create cart');
        }

        // Add item to cart using the database
        const cartItemId = await upsertOrRemoveCartItem(
            null, // id - null for new item
            cart.id, // cartId
            input.productId, // entityId
            'plantSort', // entityTypeName - assume products are plant sorts
            input.quantity, // amount
            undefined, // gardenId
            undefined, // raisedBedId
            undefined, // positionIndex
            null, // additionalData
            'eur', // currency
            false, // forceCreate
            false, // forceDelete
        );

        if (!cartItemId) {
            throw new Error('Failed to add item to cart');
        }

        return {
            success: true,
            cartItem: {
                id: cartItemId.toString(),
                productId: input.productId,
                quantity: input.quantity,
                addedAt: new Date().toISOString(),
            },
            message:
                input.locale === 'hr'
                    ? 'Proizvod je dodan u košaricu!'
                    : 'Product added to cart!',
            locale: input.locale,
        };
    } catch (error) {
        console.error('Error adding to cart:', error);
        return {
            success: false,
            error:
                input.locale === 'hr'
                    ? 'Greška pri dodavanju u košaricu'
                    : 'Error adding to cart',
            locale: input.locale,
        };
    }
}

async function handleUpdateCartItem(
    input: z.infer<typeof UpdateCartItemSchema>,
    auth: MCPAuth,
) {
    const cart = await getOrCreateShoppingCart(auth.accountId);
    if (!cart) {
        return { success: false, error: 'Failed to get or create cart' };
    }

    const item = cart.items.find(
        (cartItem) => cartItem.id === input.cartItemId,
    );
    if (!item) {
        return { success: false, error: 'Cart item not found' };
    }

    const updatedId = await upsertOrRemoveCartItem(
        input.cartItemId,
        cart.id,
        item.entityId,
        item.entityTypeName,
        input.quantity,
        item.gardenId ?? undefined,
        item.raisedBedId ?? undefined,
        item.positionIndex ?? undefined,
        item.additionalData ?? null,
        item.currency || 'eur',
        false,
        false, // Keep storage-layer paid item deletion protection active.
    );

    return {
        success: Boolean(updatedId) || input.quantity === 0,
        action: input.quantity === 0 ? 'removed' : 'updated',
        cartItemId: input.cartItemId,
        newQuantity: input.quantity,
        locale: input.locale,
    };
}
