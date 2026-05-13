import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Logger } from "../logger";
import { negotiateMcpProtocolVersion } from "../protocol";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const protocolVersion = negotiateMcpProtocolVersion(request);
  return NextResponse.json({
    jsonrpc: "2.0",
    result: {
      protocolVersion,
      capabilities: {
        tools: {
          listChanged: false,
        },
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: "gredice-mcp-gardens",
        version: "1.0.0",
        description: "Account-scoped read-only garden context tools",
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const logger = new Logger();

  try {
    const body = await request.json();
    const { method } = body;
    const protocolVersion = negotiateMcpProtocolVersion(request);

    logger.info("mcp.gardens.request", {
      method,
      timestamp: new Date().toISOString(),
    });

    switch (method) {
      case "initialize":
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            protocolVersion,
            capabilities: {
              tools: {
                listChanged: false,
              },
              resources: {},
              prompts: {},
            },
            serverInfo: {
              name: "gredice-mcp-gardens",
              version: "1.0.0",
            },
          },
          id: body.id,
        });

      case "prompts/list":
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            prompts: [],
          },
          id: body.id,
        });

      case "tools/list":
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            tools: [
              {
                name: "gardens/list-gardens",
                description:
                  "List gardens for authenticated account (gardens:read)",
                inputSchema: {
                  type: "object",
                  properties: {
                    limit: {
                      type: "number",
                      minimum: 1,
                      maximum: 100,
                      default: 20,
                    },
                    offset: { type: "number", minimum: 0, default: 0 },
                  },
                },
              },
              {
                name: "gardens/list-raised-beds",
                description:
                  "List raised beds for one authenticated-account garden (gardens:read)",
                inputSchema: {
                  type: "object",
                  properties: { gardenId: { type: "string" } },
                  required: ["gardenId"],
                },
              },
              {
                name: "gardens/get-raised-bed-fields",
                description: "Get field state for a raised bed (gardens:read)",
                inputSchema: {
                  type: "object",
                  properties: {
                    gardenId: { type: "string" },
                    raisedBedId: { type: "number" },
                  },
                  required: ["gardenId", "raisedBedId"],
                },
              },
              {
                name: "gardens/list-operations",
                description:
                  "List operation/diary timeline in one garden (gardens:read)",
                inputSchema: {
                  type: "object",
                  properties: {
                    gardenId: { type: "string" },
                    raisedBedId: { type: "number" },
                    limit: {
                      type: "number",
                      minimum: 1,
                      maximum: 100,
                      default: 20,
                    },
                    offset: { type: "number", minimum: 0, default: 0 },
                  },
                  required: ["gardenId"],
                },
              },
              {
                name: "gardens/get-lifecycle-context",
                description:
                  "Get compact lifecycle context summary for one garden (gardens:read)",
                inputSchema: {
                  type: "object",
                  properties: { gardenId: { type: "string" } },
                  required: ["gardenId"],
                },
              },
            ],
          },
          id: body.id,
        });

      case "notifications/initialized":
        // Client has finished initializing - acknowledge
        return NextResponse.json({
          jsonrpc: "2.0",
          result: null,
          id: body.id,
        });

      case "resources/list":
        // Return list of available resources
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            resources: [],
          },
          id: body.id,
        });

      case "resources/templates/list":
        // Return list of available resource templates
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            resourceTemplates: [],
          },
          id: body.id,
        });

      case "tools/call": {
        // Redirect to the tools/call endpoint
        const toolsResponse = await fetch(
          new URL(`${process.env.MCP_BASE_URL}/gardens/tools/call`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: request.headers.get("Authorization") || "",
            },
            body: JSON.stringify(body),
          },
        );

        return new NextResponse(toolsResponse.body, {
          status: toolsResponse.status,
          headers: toolsResponse.headers,
        });
      }

      default:
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
            id: body.id,
          },
          { status: 400 },
        );
    }
  } catch (error) {
    logger.error("mcp.gardens.error", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
        },
      },
      { status: 500 },
    );
  }
}
