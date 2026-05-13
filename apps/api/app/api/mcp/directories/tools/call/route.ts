import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMcpToolNamesByDomain } from '../../../catalog';
import { Logger } from '../../../logger';
import { DirectoryToolNotFoundError, executeDirectoryTool } from './execute';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'gredice-mcp-directories',
        availableTools: getMcpToolNamesByDomain('directories'),
    });
}

export async function POST(request: NextRequest) {
    const logger = new Logger();
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();

    try {
        const body = await request.json();
        const { name, arguments: args } = body.params || {};

        logger.info('mcp.directories.tool.start', {
            toolName: name,
            correlationId,
            timestamp: new Date().toISOString(),
        });

        const result = await executeDirectoryTool(name, args);

        logger.info('mcp.directories.tool.success', {
            toolName: name,
            correlationId,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        });

        await logger.flush();

        return NextResponse.json({
            jsonrpc: '2.0',
            result,
            id: body.id || correlationId,
        });
    } catch (error) {
        logger.error('mcp.directories.tool.error', {
            correlationId,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        });

        await logger.flush();

        const isInvalidParams = error instanceof z.ZodError;
        const isUnknownTool = error instanceof DirectoryToolNotFoundError;
        const statusCode = isInvalidParams || isUnknownTool ? 400 : 500;

        return NextResponse.json(
            {
                jsonrpc: '2.0',
                error: {
                    code: isInvalidParams
                        ? -32602
                        : isUnknownTool
                          ? -32601
                          : -32603,
                    message: isInvalidParams
                        ? 'Invalid params'
                        : error instanceof Error
                          ? error.message
                          : 'Tool execution failed',
                    data: isInvalidParams ? error.issues : undefined,
                },
                id: isUnknownTool ? null : correlationId,
            },
            { status: statusCode },
        );
    }
}
