import { getAccountGardens, getGarden, getOperations } from "@gredice/storage";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkMCPPermission,
  createMCPAuthError,
  extractMCPAuth,
  type MCPAuth,
} from "../../../auth";
import { Logger } from "../../../logger";

export const dynamic = "force-dynamic";

const GardenIdPattern = /^[1-9]\d*$/;
const GardenIdSchema = z
  .string()
  .regex(GardenIdPattern, "gardenId must be a positive integer string");

const ListGardensSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const GetRaisedBedsSchema = z.object({
  gardenId: GardenIdSchema,
});

const GetRaisedBedFieldsSchema = z.object({
  gardenId: GardenIdSchema,
  raisedBedId: z.number(),
});

const GetGardenOperationsSchema = z.object({
  gardenId: GardenIdSchema,
  raisedBedId: z.number().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const GetGardenLifecycleSchema = z.object({
  gardenId: GardenIdSchema,
});

class MCPToolError extends Error {
  readonly statusCode: number;
  readonly code: number;

  constructor(message: string, statusCode: number, code: number) {
    super(message);
    this.name = "MCPToolError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    server: "gredice-mcp-gardens",
    authScope: "gardens:read",
    availableTools: [
      "gardens/list-gardens",
      "gardens/list-raised-beds",
      "gardens/get-raised-bed-fields",
      "gardens/list-operations",
      "gardens/get-lifecycle-context",
    ],
  });
}

async function getOwnedGardenOrThrow(auth: MCPAuth, gardenId: string) {
  const parsedGardenId = Number(gardenId);
  if (!GardenIdPattern.test(gardenId) || !Number.isSafeInteger(parsedGardenId)) {
    throw new MCPToolError("Invalid gardenId", 400, -32602);
  }

  const garden = await getGarden(parsedGardenId);
  if (!garden || garden.accountId !== auth.accountId) {
    throw new MCPToolError(
      "Garden not found for authenticated account",
      403,
      -32001,
    );
  }

  return garden;
}

export async function POST(request: NextRequest) {
  const logger = new Logger();
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  try {
    const auth = await extractMCPAuth(request);
    if (!auth) {
      return NextResponse.json(
        createMCPAuthError(null, "unauthorized", correlationId),
        { status: 401 },
      );
    }

    if (!checkMCPPermission(auth, "gardens:read")) {
      return NextResponse.json(
        createMCPAuthError(auth, "forbidden", correlationId),
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, arguments: args } = body.params || {};
    let result: unknown;

    switch (name) {
      case "gardens/list-gardens": {
        const input = ListGardensSchema.parse(args ?? {});
        const gardens = await getAccountGardens(auth.accountId);
        result = {
          items: gardens
            .slice(input.offset, input.offset + input.limit)
            .map((garden) => ({
              id: garden.id,
              name: garden.name,
              createdAt: garden.createdAt,
              raisedBedsCount: garden.raisedBeds.length,
            })),
          total: gardens.length,
          limit: input.limit,
          offset: input.offset,
        };
        break;
      }
      case "gardens/list-raised-beds": {
        const input = GetRaisedBedsSchema.parse(args);
        const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
        result = {
          gardenId: garden.id,
          items: garden.raisedBeds.map((bed) => ({
            id: bed.id,
            name: bed.name,
            fieldsCount: bed.fields.length,
          })),
        };
        break;
      }
      case "gardens/get-raised-bed-fields": {
        const input = GetRaisedBedFieldsSchema.parse(args);
        const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
        const raisedBed = garden.raisedBeds.find(
          (bed) => bed.id === input.raisedBedId,
        );
        if (!raisedBed) {
          throw new MCPToolError(
            "Raised bed not found in garden",
            400,
            -32602,
          );
        }
        result = {
          gardenId: garden.id,
          raisedBedId: raisedBed.id,
          items: raisedBed.fields.map((field) => ({
            id: field.id,
            positionIndex: field.positionIndex,
            active: field.active,
            plantSortId: field.plantSortId,
            plantStatus: field.plantStatus,
          })),
        };
        break;
      }
      case "gardens/list-operations": {
        const input = GetGardenOperationsSchema.parse(args);
        const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
        const operations = await getOperations(
          auth.accountId,
          garden.id,
          input.raisedBedId,
        );
        const sliced = operations.slice(
          input.offset,
          input.offset + input.limit,
        );
        result = {
          gardenId: garden.id,
          items: sliced.map((operation) => ({
            id: operation.id,
            status: operation.status,
            createdAt: operation.createdAt,
            entityTypeName: operation.entityTypeName,
            entityId: operation.entityId,
            raisedBedId: operation.raisedBedId,
          })),
          total: operations.length,
          limit: input.limit,
          offset: input.offset,
        };
        break;
      }
      case "gardens/get-lifecycle-context": {
        const input = GetGardenLifecycleSchema.parse(args);
        const garden = await getOwnedGardenOrThrow(auth, input.gardenId);
        const activeFields = garden.raisedBeds
          .flatMap((bed) => bed.fields)
          .filter((f) => f.active && f.plantSortId);
        result = {
          gardenId: garden.id,
          raisedBedsCount: garden.raisedBeds.length,
          activePlantFieldsCount: activeFields.length,
          hasLifecycleActivity: activeFields.length > 0,
        };
        break;
      }
      default:
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            error: { code: -32601, message: `Method not found: ${name}` },
            id: null,
          },
          { status: 400 },
        );
    }

    logger.info("mcp.gardens.tool.success", {
      toolName: name,
      correlationId,
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ jsonrpc: "2.0", result, id: body.id || null });
  } catch (error) {
    logger.error("mcp.gardens.tool.error", {
      correlationId,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const isInvalidParams = error instanceof z.ZodError;
    const toolError = error instanceof MCPToolError ? error : undefined;
    const statusCode = isInvalidParams
      ? 400
      : (toolError?.statusCode ?? 500);
    const errorCode = isInvalidParams ? -32602 : (toolError?.code ?? -32603);
    const errorMessage = isInvalidParams
      ? "Invalid params"
      : (toolError?.message ?? "Tool execution failed");
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: errorCode,
          message: errorMessage,
          data: isInvalidParams ? error.issues : undefined,
        },
        id: null,
      },
      { status: statusCode },
    );
  }
}
