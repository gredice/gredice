# Gredice MCP Platform

**Model Context Protocol (MCP) Implementation for Croatian Gardening Platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.6-black.svg)](https://nextjs.org/)
[![MCP](https://img.shields.io/badge/MCP-JSON--RPC%202.0-green.svg)](https://modelcontextprotocol.io/)
[![Tests](https://img.shields.io/badge/Tests-21%20Passing-brightgreen.svg)](./tests/mcp.spec.ts)

## Overview

The Gredice MCP Platform provides AI assistants with secure, structured access to Croatian gardening data and garden management tools through the Model Context Protocol. Our implementation supports three specialized MCP servers for different functional domains.

## Architecture

```text
🌱 Gredice MCP Platform
├── 📚 Directories Server  - Croatian plant & botanical data
├── 🏡 Gardens Server      - Garden & raised bed management  
└── 🛒 Commerce Server     - Seeds & tools marketplace
```

- **Commerce**: Shopping cart and checkout functionality
- **Accounts**: User account and authentication services
- **Notifications**: Messaging and notification services

## MCP Protocol Overview

Model Context Protocol (MCP) is a standardized way for AI assistants to interact with external systems. Gredice implements MCP using:

- **Transport**: HTTP-based JSON-RPC 2.0 protocol
- **Authentication**: JWT-based with OAuth 2.1 support
- **Session Management**: Stateless design optimized for serverless environments

### Server Structure

```text
/api/mcp/
├── core/           # Main MCP coordinator server
├── directories/    # Public entity collections (plants, seeds, operations)
├── gardens/        # Garden and raised bed management
├── accounts/       # User account and authentication services
├── commerce/       # Shopping cart and checkout functionality
└── notifications/  # Notification and messaging services
```

### Core Components

1. **StreamableHTTPTransport**: Handles HTTP-based MCP communication
2. **Authentication Middleware**: JWT validation with role-based access
3. **Logging**: Comprehensive request/response logging via Axiom
4. **Error Handling**: Standardized error responses with correlation IDs

## Authentication and Authorization

### JWT Integration

All MCP endpoints require valid JWT authentication:

```typescript
Authorization: Bearer <jwt_token>
```

### Scopes

- `mcp:read`: Read access to resources and tools
- `mcp:write`: Write access for mutating operations
- `mcp:admin`: Administrative access to all MCP functions

### Role Matrix

| Tool/Resource | mcp:read | mcp:write | mcp:admin |
|--------------|----------|-----------|-----------|
| directories/* | ✓ | ✗ | ✓ |
| gardens/list-* | ✓ | ✗ | ✓ |
| gardens/update-* | ✗ | ✓ | ✓ |
| commerce/get-* | ✓ | ✗ | ✓ |
| commerce/add-* | ✗ | ✓ | ✓ |
| accounts/* | ✗ | ✓ | ✓ |

## Available Servers

### 1. Directories MCP Server

**Endpoint**: `/api/mcp/directories`

Provides access to public entity collections including plants, seeds, operations, and botanical information.

#### Tools - Directories

- `directories/get-plants`: Retrieve all plants with attributes and calendar data
- `directories/get-plant-sorts`: Get plant varieties for specific plants
- `directories/get-plant`: Get detailed information for a specific plant
- `directories/search-entities`: Search across entity types
- `directories/get-operations`: Get agricultural operations
- `directories/get-seeds`: Get seed catalog information

#### Resources

- Plant entity data (Croatian/Latin names, descriptions)
- Plant sort information with planting/harvest calendars
- Agricultural operation definitions and timing
- Seed and product catalog data

### 2. Gardens MCP Server

**Endpoint**: `/api/mcp/gardens`

Manages raised beds, plant fields, and garden operations.

#### Tools - Gardens

- `gardens/list-raised-beds`: List all raised beds in a garden
- `gardens/get-raised-bed`: Get raised bed details with field information
- `gardens/update-raised-bed`: Update raised bed name and status
- `gardens/plant-field`: Plant a specific crop in a raised bed field
- `gardens/update-field-status`: Update plant status (sowed, sprouted, harvested)
- `gardens/get-field-lifecycle`: Get plant growth lifecycle data
- `gardens/remove-field-plant`: Remove plant from field when harvestable
- `gardens/get-raised-bed-diary`: Get diary entries for raised bed operations

#### Resources

- Raised bed configurations and field layouts
- Plant lifecycle and growth stage data
- Field operation history and diary entries
- Plant sort compatibility information

### 3. Commerce MCP Server

**Endpoint**: `/api/mcp/commerce`

Handles shopping cart management, dual currency support, and checkout processes.

#### Tools - Commerce

- `commerce/get-shopping-cart`: Retrieve current cart with comprehensive details
- `commerce/add-to-cart`: Add garden items with placement context
- `commerce/update-cart-item`: Modify quantities or switch currency
- `commerce/remove-cart-item`: Remove specific items from cart
- `commerce/checkout`: Process payment with delivery coordination
- `commerce/get-sunflower-balance`: Check sunflower currency balance
- `commerce/convert-currency`: Switch between EUR and sunflower pricing
- `commerce/track-order-status`: Monitor cart and payment processing

#### Currency System

- **Primary**: EUR (Euro)
- **Secondary**: 🌻 (Sunflowers)
- **Exchange Rate**: 1 EUR = 1000 🌻
- **Minimum Cart**: €0.50
- **Sunflower Earning**: 10 🌻 per 1 EUR spent

### 4. Accounts MCP Server

**Endpoint**: `/api/mcp/accounts`

Provides user account management and authentication services.

### 5. Notifications MCP Server

**Endpoint**: `/api/mcp/notifications`

Handles messaging and notification management.

## Tool and Resource Schemas

### Input/Output Formats

All tools use structured JSON input/output with Zod validation:

```typescript
// Example: directories/get-plant
Input: {
  plantId: string;
  includeSorts?: boolean;
  locale?: "hr" | "en";
}

Output: {
  id: string;
  name: string;
  nameLatin: string;
  description: string;
  sorts?: PlantSort[];
  calendar?: PlantingCalendar;
}
```

### Error Responses

Standardized error format with correlation IDs:

```typescript
{
  error: {
    code: number;        // HTTP status code
    message: string;     // Human-readable message
    correlationId: string; // For tracking
    details?: any;       // Additional context
  }
}
```

## Client Integration Examples

### Basic MCP Client Setup

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPTransport } from '@hono/mcp';

const transport = new StreamableHTTPTransport({
  baseUrl: 'https://api.gredice.com/api/mcp/core',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const client = new Client(
  { name: 'gredice-client', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);
```

### Using Tools

```typescript
// Get all plants
const plants = await client.request({
  method: 'tools/call',
  params: {
    name: 'directories/get-plants',
    arguments: { locale: 'hr' }
  }
});

// Plant a field
const result = await client.request({
  method: 'tools/call',
  params: {
    name: 'gardens/plant-field',
    arguments: {
      raisedBedId: 'bed-123',
      fieldPosition: 0,
      plantSortId: 'sort-456',
      quantity: 10
    }
  }
});
```

### Error Handling

```typescript
try {
  const result = await client.request({
    method: 'tools/call',
    params: { name: 'gardens/plant-field', arguments: {} }
  });
} catch (error) {
  if (error.code === 400) {
    console.log('Validation error:', error.details);
  } else if (error.code === 401) {
    console.log('Authentication required');
  } else if (error.code === 403) {
    console.log('Insufficient permissions');
  }
}
```

## Development Environment

### Local Setup

1. **Install Dependencies**:

   ```bash
   cd /path/to/gredice
   pnpm install
   ```

2. **Environment Variables**:

   ```bash
   # .env
   GREDICE_MCP_JWT_SECRET=your_jwt_secret
   ```

3. **Start Development Server**:

   ```bash
   pnpm dev --filter @gredice/api
   ```

### Testing MCP Endpoints

```bash
# Health check
curl https://api.gredice.test/api/mcp/core/health

# Test authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.gredice.test/api/mcp/core/mcp
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify JWT token is valid and not expired
   - Check that required scopes are present
   - Ensure Authorization header format is correct

2. **Connection Errors**:
   - Verify MCP server is running
   - Check CORS configuration for client domain
   - Ensure firewall allows connections

3. **Tool Validation Errors**:
   - Check input schema matches tool requirements
   - Verify all required parameters are provided
   - Ensure data types match expected formats

### Debug Logging

Enable debug logging by setting environment variable:

```bash
MCP_DEBUG=true
```

Logs are sent to Axiom with correlation IDs for tracking requests across services.

## Performance Considerations

### Rate Limiting

- **Per User**: 1000 requests/hour
- **Per Account**: 10000 requests/hour
- **Burst Limit**: 100 requests/minute

### Caching

- Plant/entity data cached for 1 hour
- Garden state cached for 5 minutes
- Shopping cart cached for 30 seconds

### Optimization Tips

1. Use batch operations when possible
2. Implement client-side caching for static data
3. Use WebSocket connections for real-time updates
4. Minimize payload sizes by requesting only needed fields

## Security

### Best Practices

1. **Token Management**:
   - Use short-lived tokens (15 minutes)
   - Implement token refresh mechanism
   - Store tokens securely (not in localStorage)

2. **Input Validation**:
   - All inputs validated with Zod schemas
   - SQL injection prevention via parameterized queries
   - XSS prevention via output encoding

3. **Access Control**:
   - Principle of least privilege
   - Resource-level authorization checks
   - Audit logging for all mutations

## Monitoring and Observability

### Metrics

- Request latency percentiles (p50, p90, p99)
- Error rates by endpoint and error type
- Authentication success/failure rates
- Tool usage patterns

### Alerting

- High error rates (>5% over 5 minutes)
- Slow response times (>1s p95 over 5 minutes)
- Authentication failures (>100/hour per IP)

### Dashboards

Access monitoring dashboards at:

- **Axiom**: Application logs and metrics
- **Vercel**: Deployment and performance metrics
