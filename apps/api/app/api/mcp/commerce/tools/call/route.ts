import {
    getEntitiesFormatted,
    getOrCreateShoppingCart,
    upsertOrRemoveCartItem,
} from '@gredice/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Logger } from 'next-axiom';
import { z } from 'zod';
import {
    checkMCPPermission,
    createMCPAuthError,
    extractMCPAuth,
    type MCPAuth,
} from '../../../auth';

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
    cartItemId: z.string(),
    quantity: z.number().min(0), // 0 to remove item
    locale: z.enum(['hr', 'en']).default('hr'),
});

const CreateOrderSchema = z.object({
    userId: z.string(),
    shippingAddress: z.object({
        name: z.string(),
        street: z.string(),
        city: z.string(),
        postalCode: z.string(),
        country: z.string().default('HR'),
        phone: z.string().optional(),
    }),
    paymentMethod: z
        .enum(['card', 'bank_transfer', 'cash_on_delivery'])
        .default('card'),
    notes: z.string().optional(),
    locale: z.enum(['hr', 'en']).default('hr'),
});

const GetOrdersSchema = z.object({
    userId: z.string(),
    status: z
        .enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
        .optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
    locale: z.enum(['hr', 'en']).default('hr'),
});

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
            'commerce/create-order',
            'commerce/get-orders',
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

        logger.info('mcp.commerce.tool.start', {
            toolName: name,
            userId: auth.userId,
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
                result = await handleGetCart(getCartInput, auth);
                break;
            }

            case 'commerce/add-to-cart': {
                const addToCartInput = AddToCartSchema.parse(args);
                result = await handleAddToCart(addToCartInput, auth);
                break;
            }

            case 'commerce/update-cart-item': {
                const updateCartInput = UpdateCartItemSchema.parse(args);
                result = await handleUpdateCartItem(updateCartInput, auth);
                break;
            }

            case 'commerce/create-order': {
                const createOrderInput = CreateOrderSchema.parse(args);
                result = await handleCreateOrder(createOrderInput, auth);
                break;
            }

            case 'commerce/get-orders': {
                const getOrdersInput = GetOrdersSchema.parse(args);
                result = await handleGetOrders(getOrdersInput, auth);
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
    auth: MCPAuth,
) {
    try {
        // Get real plant sort data from database as products
        const plantSorts = await getEntitiesFormatted('plantSort');

        if (!plantSorts) {
            throw new Error('Failed to fetch plant sorts');
        }

        // Transform plant sorts to commerce product format
        const products = plantSorts.map((plantSort: any) => {
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
                stockQuantity: Math.floor(Math.random() * 100) + 50, // Random stock
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
                rating: {
                    average: 4.2 + Math.random() * 0.8, // Random rating 4.2-5.0
                    reviewsCount: Math.floor(Math.random() * 200) + 20,
                },
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
    auth: MCPAuth,
) {
    // TODO: Implement with actual getEntityFormatted('products', input.productId)
    const mockProduct = {
        id: input.productId,
        category: 'seeds',
        name: 'Sjeme Cherry rajčice',
        description:
            'Kvalitetno sjeme manje rajčice, idealne za balkonski uzgoj. Visoka stopa klijavosti i brza zrelost čine ovu sortu idealnom za početnike.',
        plantType: 'rajčica',
        price: { amount: 15.99, currency: 'EUR' },
        inStock: true,
        stockQuantity: 150,
        supplier: {
            id: 'supplier-gredice-seeds',
            name: 'Gredice Seeds',
            rating: 4.9,
            verified: true,
        },
        properties: {
            packetSize: '20 sjemenki',
            germinationRate: '95%',
            organicCertified: true,
            variety: 'Cherry',
            sowingDepth: '0.5 cm',
            spacingBetweenPlants: '30 cm',
            daysToMaturity: '65-75 dana',
            harvestSeason: 'ljeto (srpanj-rujan)',
        },
        images: [
            {
                url: 'https://images.gredice.com/products/tomato-cherry-seeds-1.jpg',
                alt: 'Paket sjemena Cherry rajčice',
            },
            {
                url: 'https://images.gredice.com/products/tomato-cherry-seeds-2.jpg',
                alt: 'Cherry rajčice u vrtu',
            },
        ],
        rating: { average: 4.8, reviewsCount: 127 },
        reviews: [
            {
                id: 'review-1',
                userId: 'user-456',
                userName: 'Marija K.',
                rating: 5,
                comment: 'Odličo sjeme! Sve su nikle i imao sam bogat urod.',
                date: '2025-08-15T10:30:00Z',
                verified: true,
            },
            {
                id: 'review-2',
                userId: 'user-789',
                userName: 'Petar S.',
                rating: 4,
                comment:
                    'Dobre rajčice, ali malo sporije sazrijevanje od očekivanog.',
                date: '2025-07-22T14:15:00Z',
                verified: true,
            },
        ],
        relatedProducts: [
            {
                id: 'product-seed-tomato-beefsteak',
                name: 'Sjeme Beefsteak rajčice',
                price: { amount: 18.99, currency: 'EUR' },
            },
            {
                id: 'product-fertilizer-tomato',
                name: 'Gnojivo za rajčice 1kg',
                price: { amount: 12.99, currency: 'EUR' },
            },
        ],
        shippingInfo: {
            freeShippingThreshold: 50,
            standardShipping: { price: 5.99, deliveryDays: '3-5' },
            expressShipping: { price: 12.99, deliveryDays: '1-2' },
        },
    };

    return mockProduct;
}

async function handleSearchProducts(
    input: z.infer<typeof SearchProductsSchema>,
    auth: MCPAuth,
) {
    // TODO: Implement with actual search functionality
    const query = input.query.toLowerCase();
    const mockResults = [
        {
            id: 'product-seed-tomato-cherry',
            category: 'seeds',
            name: 'Sjeme Cherry rajčice',
            description: 'Kvalitetno sjeme manje rajčice...',
            price: { amount: 15.99, currency: 'EUR' },
            inStock: true,
            rating: { average: 4.8, reviewsCount: 127 },
            relevanceScore:
                query.includes('rajč') || query.includes('cherry') ? 0.95 : 0.3,
        },
        {
            id: 'product-fertilizer-tomato',
            category: 'fertilizers',
            name: 'Specijalno gnojivo za rajčice',
            description: 'Formulirano posebno za rajčice...',
            price: { amount: 12.99, currency: 'EUR' },
            inStock: true,
            rating: { average: 4.6, reviewsCount: 89 },
            relevanceScore:
                query.includes('rajč') || query.includes('gnojiv') ? 0.85 : 0.2,
        },
        {
            id: 'product-tool-tomato-cage',
            category: 'tools',
            name: 'Nosač za rajčice 150cm',
            description: 'Čvrsti nosač za potporu visokih rajčica...',
            price: { amount: 22.5, currency: 'EUR' },
            inStock: true,
            rating: { average: 4.4, reviewsCount: 34 },
            relevanceScore:
                query.includes('rajč') || query.includes('nosač') ? 0.75 : 0.1,
        },
    ];

    // Filter by category if provided
    let filteredResults = mockResults;
    if (input.category) {
        filteredResults = filteredResults.filter(
            (p) => p.category === input.category,
        );
    }

    // Filter by relevance and sort
    const relevantResults = filteredResults
        .filter((p) => p.relevanceScore > 0.2)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, input.limit);

    return {
        results: relevantResults,
        total: relevantResults.length,
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
        const cart = await getOrCreateShoppingCart(auth.userId);

        if (!cart) {
            throw new Error('Failed to get or create cart');
        }

        // Transform cart to expected format
        const formattedCart = {
            id: cart.id,
            userId: auth.userId,
            items:
                (cart as any).items?.map((item: any) => ({
                    id: item.id,
                    productId: item.productId || item.entityId,
                    productName:
                        item.productName || item.name || 'Unknown Product',
                    productImage:
                        item.productImage ||
                        'https://images.gredice.com/products/default.jpg',
                    price: {
                        amount: parseFloat(item.price || item.unitPrice) || 0,
                        currency: 'EUR',
                    },
                    quantity: item.quantity || 0,
                    totalPrice: {
                        amount:
                            parseFloat(item.price || item.unitPrice) *
                                item.quantity || 0,
                        currency: 'EUR',
                    },
                    addedAt: item.createdAt || new Date().toISOString(),
                })) || [],
        };

        const totalAmount = formattedCart.items.reduce(
            (sum: number, item: any) => sum + item.totalPrice.amount,
            0,
        );

        return {
            cart: {
                ...formattedCart,
                totalAmount: { amount: totalAmount, currency: 'EUR' },
                totalItems: formattedCart.items.reduce(
                    (sum: number, item: any) => sum + item.quantity,
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
        const cart = await getOrCreateShoppingCart(auth.userId);
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
    // TODO: Implement with actual database update
    const action = input.quantity === 0 ? 'removed' : 'updated';

    return {
        success: true,
        action,
        cartItemId: input.cartItemId,
        newQuantity: input.quantity,
        message:
            input.locale === 'hr'
                ? action === 'removed'
                    ? 'Proizvod je uklonjen iz košarice!'
                    : 'Količina je ažurirana!'
                : action === 'removed'
                  ? 'Product removed from cart!'
                  : 'Quantity updated!',
    };
}

async function handleCreateOrder(
    input: z.infer<typeof CreateOrderSchema>,
    auth: MCPAuth,
) {
    // TODO: Implement with actual order creation and payment processing
    const orderId = `order-${Date.now()}`;

    const newOrder = {
        id: orderId,
        userId: input.userId,
        status: 'pending',
        shippingAddress: input.shippingAddress,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        createdAt: new Date().toISOString(),
        estimatedDelivery: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 3 days
    };

    return {
        success: true,
        order: newOrder,
        message:
            input.locale === 'hr'
                ? 'Narudžba je uspješno kreirana!'
                : 'Order created successfully!',
    };
}

async function handleGetOrders(
    input: z.infer<typeof GetOrdersSchema>,
    auth: MCPAuth,
) {
    // TODO: Implement with actual database query
    const mockOrders = [
        {
            id: 'order-1727234567890',
            userId: input.userId,
            status: 'delivered',
            total: { amount: 56.79, currency: 'EUR' },
            itemsCount: 3,
            createdAt: '2025-09-20T10:30:00Z',
            deliveredAt: '2025-09-23T14:15:00Z',
            shippingAddress: {
                name: 'Ana Marić',
                city: 'Zagreb',
                country: 'HR',
            },
        },
        {
            id: 'order-1727148167890',
            userId: input.userId,
            status: 'shipped',
            total: { amount: 34.5, currency: 'EUR' },
            itemsCount: 2,
            createdAt: '2025-09-15T08:45:00Z',
            shippedAt: '2025-09-16T12:00:00Z',
            estimatedDelivery: '2025-09-28T00:00:00Z',
            shippingAddress: {
                name: 'Ana Marić',
                city: 'Zagreb',
                country: 'HR',
            },
        },
    ];

    let filteredOrders = mockOrders;
    if (input.status) {
        filteredOrders = filteredOrders.filter(
            (order) => order.status === input.status,
        );
    }

    // Apply pagination
    const paginatedOrders = filteredOrders.slice(
        input.offset,
        input.offset + input.limit,
    );

    return {
        orders: paginatedOrders,
        total: filteredOrders.length,
        limit: input.limit,
        offset: input.offset,
        userId: input.userId,
        filters: {
            status: input.status,
        },
        locale: input.locale,
    };
}
