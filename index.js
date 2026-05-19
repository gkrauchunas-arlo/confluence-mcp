#!/usr/bin/env node

/**
 * Confluence MCP Server
 * Provides integration with Atlassian Confluence via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const ATLASSIAN_SITE = process.env.ATLASSIAN_SITE;
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;

// Validate configuration
if (!ATLASSIAN_SITE || !ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('ERROR: ATLASSIAN_SITE, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN must be set');
  process.exit(1);
}

// API Base URL
const CONFLUENCE_API_BASE = `https://${ATLASSIAN_SITE}/wiki/rest/api`;

// HTTP client with auth
const client = axios.create({
  auth: {
    username: ATLASSIAN_EMAIL,
    password: ATLASSIAN_API_TOKEN,
  },
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

/**
 * Search content using CQL (Confluence Query Language)
 */
async function searchContent(query, limit = 10, spaceKey = null) {
  try {
    let cql = query;
    if (spaceKey) {
      cql = `${query} AND space=${spaceKey}`;
    }

    const response = await client.get(`${CONFLUENCE_API_BASE}/content/search`, {
      params: { cql, limit, expand: 'space,version' }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to search content: ${error.message}`);
  }
}

/**
 * List all spaces
 */
async function listSpaces(limit = 25) {
  try {
    const response = await client.get(`${CONFLUENCE_API_BASE}/space`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to list spaces: ${error.message}`);
  }
}

/**
 * Get a specific page by ID
 */
async function getPage(pageId, includeAttachments = true) {
  try {
    const expand = ['body.storage', 'version', 'space', 'ancestors'];
    if (includeAttachments) {
      expand.push('children.attachment');
    }

    const response = await client.get(`${CONFLUENCE_API_BASE}/content/${pageId}`, {
      params: { expand: expand.join(',') }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get page: ${error.message}`);
  }
}

/**
 * Get page by title and space key
 */
async function getPageByTitle(title, spaceKey, includeAttachments = true) {
  try {
    const expand = ['body.storage', 'version', 'space'];
    if (includeAttachments) {
      expand.push('children.attachment');
    }

    const response = await client.get(`${CONFLUENCE_API_BASE}/content`, {
      params: {
        title,
        spaceKey,
        expand: expand.join(',')
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
    throw new Error(`Page not found: ${title} in space ${spaceKey}`);
  } catch (error) {
    throw new Error(`Failed to get page by title: ${error.message}`);
  }
}

/**
 * Get space information
 */
async function getSpace(spaceKey) {
  try {
    const response = await client.get(`${CONFLUENCE_API_BASE}/space/${spaceKey}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get space: ${error.message}`);
  }
}

/**
 * Create a new page
 */
async function createPage(title, spaceKey, content, parentId = null) {
  try {
    const payload = {
      type: 'page',
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    if (parentId) {
      payload.ancestors = [{ id: parentId }];
    }

    const response = await client.post(`${CONFLUENCE_API_BASE}/content`, payload);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to create page: ${error.message}`);
  }
}

/**
 * Update an existing page
 */
async function updatePage(pageId, title, content, version) {
  try {
    const payload = {
      version: { number: version + 1 },
      title,
      type: 'page',
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    const response = await client.put(`${CONFLUENCE_API_BASE}/content/${pageId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update page: ${error.message}`);
  }
}

/**
 * Add labels to a page
 */
async function addLabels(pageId, labels) {
  try {
    const payload = labels.map(name => ({
      prefix: 'global',
      name
    }));

    const response = await client.post(
      `${CONFLUENCE_API_BASE}/content/${pageId}/label`,
      payload
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to add labels: ${error.message}`);
  }
}

/**
 * Get attachments for a page
 */
async function getAttachments(pageId) {
  try {
    const response = await client.get(
      `${CONFLUENCE_API_BASE}/content/${pageId}/child/attachment`,
      { params: { expand: 'version' } }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get attachments: ${error.message}`);
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'confluence-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'confluence_search',
        description: 'Search Confluence content using CQL (Confluence Query Language). Example queries: "type=page AND title~\\"API\\"", "type=page ORDER BY lastmodified DESC"',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'CQL search query (e.g., "type=page AND title~\\"keyword\\"")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
            },
            spaceKey: {
              type: 'string',
              description: 'Optional space key to limit search to a specific space',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'confluence_list_spaces',
        description: 'List all Confluence spaces accessible to the user',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of spaces to return (default: 25)',
            },
          },
        },
      },
      {
        name: 'confluence_get_page',
        description: 'Get a Confluence page by ID including its content, version, metadata, and attachments. Attachments include download URLs for images and diagrams.',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The ID of the page to retrieve',
            },
          },
          required: ['pageId'],
        },
      },
      {
        name: 'confluence_get_page_by_title',
        description: 'Find a Confluence page by its title and space key. Returns page content, metadata, and attachments with download URLs.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The exact title of the page',
            },
            spaceKey: {
              type: 'string',
              description: 'The key of the space containing the page',
            },
          },
          required: ['title', 'spaceKey'],
        },
      },
      {
        name: 'confluence_get_space',
        description: 'Get information about a specific Confluence space',
        inputSchema: {
          type: 'object',
          properties: {
            spaceKey: {
              type: 'string',
              description: 'The key of the space to retrieve',
            },
          },
          required: ['spaceKey'],
        },
      },
      {
        name: 'confluence_create_page',
        description: 'Create a new Confluence page in a specific space',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title of the new page',
            },
            spaceKey: {
              type: 'string',
              description: 'The key of the space where the page will be created',
            },
            content: {
              type: 'string',
              description: 'The page content in Confluence storage format (HTML)',
            },
            parentId: {
              type: 'string',
              description: 'Optional ID of the parent page (creates a child page)',
            },
          },
          required: ['title', 'spaceKey', 'content'],
        },
      },
      {
        name: 'confluence_update_page',
        description: 'Update an existing Confluence page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The ID of the page to update',
            },
            title: {
              type: 'string',
              description: 'The new title for the page',
            },
            content: {
              type: 'string',
              description: 'The new content in Confluence storage format (HTML)',
            },
            version: {
              type: 'number',
              description: 'Current version number of the page (will be incremented)',
            },
          },
          required: ['pageId', 'title', 'content', 'version'],
        },
      },
      {
        name: 'confluence_add_labels',
        description: 'Add labels (tags) to a Confluence page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The ID of the page',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of label names to add',
            },
          },
          required: ['pageId', 'labels'],
        },
      },
      {
        name: 'confluence_get_attachments',
        description: 'Get list of attachments for a Confluence page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The ID of the page',
            },
          },
          required: ['pageId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'confluence_search': {
        const result = await searchContent(
          args.query,
          args.limit || 10,
          args.spaceKey
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_list_spaces': {
        const result = await listSpaces(args.limit || 25);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_get_page': {
        const result = await getPage(args.pageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_get_page_by_title': {
        const result = await getPageByTitle(args.title, args.spaceKey);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_get_space': {
        const result = await getSpace(args.spaceKey);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_create_page': {
        const result = await createPage(
          args.title,
          args.spaceKey,
          args.content,
          args.parentId
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_update_page': {
        const result = await updatePage(
          args.pageId,
          args.title,
          args.content,
          args.version
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_add_labels': {
        const result = await addLabels(args.pageId, args.labels);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'confluence_get_attachments': {
        const result = await getAttachments(args.pageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Confluence MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
