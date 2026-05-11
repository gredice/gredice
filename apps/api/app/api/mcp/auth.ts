import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { Logger } from 'next-axiom';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// JWT payload schema for MCP authentication
const MCPAuthSchema = z.object({
    userId: z.string(),
    email: z.string().email(),
    role: z.enum(['admin', 'farmer', 'gardener', 'viewer']),
    permissions: z.array(z.string()).optional(),
    locale: z.enum(['hr', 'en']).default('hr'),
    exp: z.number(),
    iat: z.number(),
});

export type MCPAuth = z.infer<typeof MCPAuthSchema>;

// MCP permission levels
export const MCPPermissions = {
    // Directories (read-only for most users)
    'directories:read': ['admin', 'farmer', 'gardener', 'viewer'],

    // Gardens (user-specific access)
    'gardens:read': ['admin', 'farmer', 'gardener'],
    'gardens:write': ['admin', 'farmer', 'gardener'],
    'gardens:admin': ['admin'],

    // Commerce (purchase access)
    'commerce:read': ['admin', 'farmer', 'gardener', 'viewer'],
    'commerce:purchase': ['admin', 'farmer', 'gardener'],
    'commerce:admin': ['admin'],

    // Advanced features
    'analytics:read': ['admin'],
    'webhooks:manage': ['admin'],
} as const;

/**
 * Extract and validate JWT token from MCP request
 */
export async function extractMCPAuth(
    request: NextRequest,
): Promise<MCPAuth | null> {
    const logger = new Logger();

    try {
        // Check Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.slice(7);
        if (!token) {
            return null;
        }

        // Verify JWT token
        const jwtSecret =
            process.env.GREDICE_MCP_JWT_SECRET ||
            'test-mcp-secret-for-development';
        if (!jwtSecret) {
            logger.error('mcp.auth.missing_secret', {
                message:
                    'GREDICE_MCP_JWT_SECRET environment variable not configured',
            });
            return null;
        }

        const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;

        // Validate the payload structure
        const authData = MCPAuthSchema.parse(decoded);

        // Check token expiration (additional safety)
        const now = Math.floor(Date.now() / 1000);
        if (authData.exp < now) {
            logger.warn('mcp.auth.token_expired', {
                userId: authData.userId,
                exp: authData.exp,
                now,
            });
            return null;
        }

        logger.info('mcp.auth.success', {
            userId: authData.userId,
            role: authData.role,
            locale: authData.locale,
        });

        return authData;
    } catch (error) {
        logger.error('mcp.auth.validation_failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        return null;
    }
}

/**
 * Check if user has required permission for MCP operation
 */
export function checkMCPPermission(
    auth: MCPAuth | null,
    permission: keyof typeof MCPPermissions,
): boolean {
    if (!auth) {
        return false;
    }

    const allowedRoles = MCPPermissions[permission];
    return (allowedRoles as readonly string[]).includes(auth.role);
}

/**
 * Check if user owns a garden (for garden-specific operations)
 */
export async function checkGardenOwnership(
    auth: MCPAuth,
    _gardenId: string,
): Promise<boolean> {
    // TODO: Implement with actual database check
    // For now, allow access if user has gardens:write permission
    return checkMCPPermission(auth, 'gardens:write');
}

/**
 * Generate Croatian error messages based on locale
 */
export function getMCPAuthError(
    auth: MCPAuth | null,
    errorType: 'unauthorized' | 'forbidden' | 'invalid_token',
) {
    const locale = auth?.locale || 'hr';

    const messages = {
        hr: {
            unauthorized: 'Neautorizovan pristup. Molimo prijavite se.',
            forbidden: 'Nemate dozvolu za ovu operaciju.',
            invalid_token:
                'Neispravna autentifikacija. Molimo prijavite se ponovo.',
        },
        en: {
            unauthorized: 'Unauthorized access. Please log in.',
            forbidden: 'You do not have permission for this operation.',
            invalid_token: 'Invalid authentication. Please log in again.',
        },
    };

    return messages[locale][errorType];
}

/**
 * Create MCP authentication middleware response
 */
export function createMCPAuthError(
    auth: MCPAuth | null,
    errorType: 'unauthorized' | 'forbidden' | 'invalid_token',
    correlationId?: string,
) {
    const logger = new Logger();

    logger.warn('mcp.auth.access_denied', {
        errorType,
        userId: auth?.userId,
        role: auth?.role,
        correlationId,
        timestamp: new Date().toISOString(),
    });

    const jsonrpcCode = errorType === 'unauthorized' ? -32000 : -32001; // Custom MCP error codes

    return {
        jsonrpc: '2.0',
        error: {
            code: jsonrpcCode,
            message: getMCPAuthError(auth, errorType),
            data: { errorType, correlationId },
        },
        id: null,
    };
}

/**
 * Middleware wrapper for MCP tools that require authentication
 */
export async function withMCPAuth(
    request: NextRequest,
    requiredPermission: keyof typeof MCPPermissions,
    handler: (request: NextRequest, auth: MCPAuth) => Promise<Response>,
): Promise<Response> {
    const correlationId = crypto.randomUUID();

    // Extract authentication
    const auth = await extractMCPAuth(request);

    if (!auth) {
        return Response.json(
            createMCPAuthError(null, 'unauthorized', correlationId),
            { status: 401 },
        );
    }

    // Check permissions
    if (!checkMCPPermission(auth, requiredPermission)) {
        return Response.json(
            createMCPAuthError(auth, 'forbidden', correlationId),
            { status: 403 },
        );
    }

    // Call the handler with authenticated user
    return handler(request, auth);
}

/**
 * Create a test JWT token for development (Croatian gardener)
 */
export function createTestMCPToken(): string {
    if (process.env.NODE_ENV !== 'development') {
        throw new Error('Test tokens can only be created in development mode');
    }

    const jwtSecret = process.env.GREDICE_MCP_JWT_SECRET || 'dev-secret-key';
    const now = Math.floor(Date.now() / 1000);

    const payload = {
        userId: 'test-user-123',
        email: 'marko@example.hr',
        role: 'gardener',
        permissions: [
            'gardens:read',
            'gardens:write',
            'commerce:read',
            'commerce:purchase',
        ],
        locale: 'hr',
        iat: now,
        exp: now + 24 * 60 * 60, // 24 hours
    };

    return jwt.sign(payload, jwtSecret);
}

// Croatian user roles and descriptions
export const UserRoleDescriptions = {
    hr: {
        admin: 'Administrator - potpuna kontrola nad sustavom',
        farmer: 'Poljoprivrednik - upravljanje velikim vrtovima i prodaja',
        gardener: 'Vrtlar - upravljanje osobnim vrtovima',
        viewer: 'Promatrač - samo čitanje informacija',
    },
    en: {
        admin: 'Administrator - full system control',
        farmer: 'Farmer - manage large gardens and sales',
        gardener: 'Gardener - manage personal gardens',
        viewer: 'Viewer - read-only access',
    },
} as const;
