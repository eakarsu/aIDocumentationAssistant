export const apiReferenceTemplate = {
  name: 'API Reference',
  description: 'Document API endpoints with parameters, responses, and examples',
  type: 'API_REFERENCE',
  content: `# API Reference

## Overview

Brief description of this API and its purpose.

## Base URL

\`\`\`
https://api.example.com/v1
\`\`\`

## Authentication

Describe authentication method (e.g., Bearer token, API key).

\`\`\`bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.example.com/v1/resource
\`\`\`

---

## Endpoints

### GET /resource

Retrieves a list of resources.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 20) |

**Response**

\`\`\`json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
\`\`\`

**Example**

\`\`\`bash
curl https://api.example.com/v1/resource?page=1&limit=10
\`\`\`

---

### POST /resource

Creates a new resource.

**Request Body**

\`\`\`json
{
  "name": "string",
  "description": "string"
}
\`\`\`

**Response**

\`\`\`json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "createdAt": "2024-01-01T00:00:00Z"
}
\`\`\`

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

## Rate Limiting

- 100 requests per minute per API key
- 429 status code when exceeded
`,
  isSystem: true,
};
