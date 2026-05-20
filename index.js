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
 * Extract attachment filenames referenced in page content
 */
function extractReferencedAttachments(htmlContent) {
  if (!htmlContent) return new Set();

  const referenced = new Set();

  // Find <ac:image> tags with ri:filename
  const imageMatches = htmlContent.matchAll(/ri:filename="([^"]+)"/g);
  for (const match of imageMatches) {
    referenced.add(match[1]);
  }

  // Find draw.io diagram references
  const drawioMatches = htmlContent.matchAll(/<ac:adf-parameter key="diagram-name">([^<]+)<\/ac:adf-parameter>/g);
  for (const match of drawioMatches) {
    const diagramName = match[1];
    // Add both .drawio and .drawio.png versions
    referenced.add(diagramName);
    referenced.add(diagramName + '.png');
  }

  // Find diagram-display-name (alternative draw.io reference)
  const displayNameMatches = htmlContent.matchAll(/<ac:adf-parameter key="diagram-display-name">([^<]+)<\/ac:adf-parameter>/g);
  for (const match of displayNameMatches) {
    const diagramName = match[1];
    referenced.add(diagramName);
    referenced.add(diagramName + '.png');
  }

  return referenced;
}

/**
 * Filter attachments to only include those referenced in page content
 */
function filterAttachments(attachments, htmlContent) {
  if (!attachments || !attachments.results) {
    return attachments;
  }

  // First, filter out temporary/system files
  let filtered = attachments.results.filter(att => {
    const title = att.title || '';
    return !title.startsWith('~drawio~') && !title.endsWith('.tmp');
  });

  // If we have HTML content, further filter to only referenced attachments
  if (htmlContent) {
    const referenced = extractReferencedAttachments(htmlContent);
    if (referenced.size > 0) {
      filtered = filtered.filter(att => referenced.has(att.title));
    }
  }

  return {
    ...attachments,
    results: filtered,
    size: filtered.length
  };
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

    const data = response.data;

    // Filter to only attachments referenced in page content
    if (includeAttachments && data.children && data.children.attachment) {
      const htmlContent = data.body?.storage?.value;
      data.children.attachment = filterAttachments(data.children.attachment, htmlContent);
    }

    return data;
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
      const data = response.data.results[0];

      // Filter to only attachments referenced in page content
      if (includeAttachments && data.children && data.children.attachment) {
        const htmlContent = data.body?.storage?.value;
        data.children.attachment = filterAttachments(data.children.attachment, htmlContent);
      }

      return data;
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

/**
 * Download an attachment by page ID and attachment ID
 * Uses REST API v1 endpoint which supports API token authentication
 */
async function downloadAttachment(pageId, attachmentId) {
  try {
    const response = await client.get(
      `${CONFLUENCE_API_BASE}/content/${pageId}/child/attachment/${attachmentId}/download`,
      {
        responseType: 'arraybuffer'
      }
    );

    return {
      content: Buffer.from(response.data).toString('utf-8'),
      contentType: response.headers['content-type'],
      size: response.data.length
    };
  } catch (error) {
    throw new Error(`Failed to download attachment: ${error.message}`);
  }
}

/**
 * Upload/update an attachment
 */
async function uploadAttachment(pageId, filename, content, contentType = 'application/octet-stream') {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();

    // Decode base64 if provided
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'base64');

    form.append('file', buffer, {
      filename,
      contentType
    });
    form.append('minorEdit', 'true');

    const response = await client.put(
      `${CONFLUENCE_API_BASE}/content/${pageId}/child/attachment`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'X-Atlassian-Token': 'no-check'
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`Failed to upload attachment: ${error.message}`);
  }
}

/**
 * Update a draw.io diagram and replace links on the page
 * This creates a new version of the diagram and updates all references on the page
 */
async function updateDiagramWithLinks(pageId, oldFilename, newContent) {
  try {
    const FormData = (await import('form-data')).default;

    // Step 1: Upload as new file with -UPDATED suffix
    const newFilename = oldFilename.replace('.drawio', '-UPDATED.drawio');
    const form = new FormData();

    form.append('file', Buffer.from(newContent, 'utf-8'), {
      filename: newFilename,
      contentType: 'application/vnd.jgraph.mxfile'
    });
    form.append('comment', 'Updated diagram via MCP');

    const uploadResp = await client.post(
      `${CONFLUENCE_API_BASE}/content/${pageId}/child/attachment`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'X-Atlassian-Token': 'nocheck'
        }
      }
    );

    const newAttachment = uploadResp.data.results[0];

    // Step 2: Get page content
    const pageResp = await client.get(
      `${CONFLUENCE_API_BASE}/content/${pageId}`,
      {
        params: { expand: 'body.storage,version' }
      }
    );

    const page = pageResp.data;
    let html = page.body.storage.value;

    // Step 3: Replace all references to old filename with new filename
    const oldEscaped = oldFilename.replace('.', '\\.');
    const regex = new RegExp(oldEscaped, 'g');
    const replacedCount = (html.match(regex) || []).length;

    html = html.replace(regex, newFilename);

    // Step 4: Update page
    const updateResp = await client.put(
      `${CONFLUENCE_API_BASE}/content/${pageId}`,
      {
        version: { number: page.version.number + 1 },
        title: page.title,
        type: 'page',
        body: {
          storage: {
            value: html,
            representation: 'storage'
          }
        }
      }
    );

    return {
      newAttachmentId: newAttachment.id,
      newFilename: newFilename,
      replacedLinksCount: replacedCount,
      pageVersion: updateResp.data.version.number
    };
  } catch (error) {
    throw new Error(`Failed to update diagram with links: ${error.message}`);
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
      {
        name: 'confluence_download_attachment',
        description: 'Download the content of an attachment (e.g., draw.io diagram). Requires page ID and attachment ID.',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The page ID containing the attachment',
            },
            attachmentId: {
              type: 'string',
              description: 'The attachment ID (e.g., att1322876959)',
            },
          },
          required: ['pageId', 'attachmentId'],
        },
      },
      {
        name: 'confluence_upload_attachment',
        description: 'Upload or update an attachment on a page. Creates new version if file exists.',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The ID of the page',
            },
            filename: {
              type: 'string',
              description: 'The filename (e.g., diagram.drawio)',
            },
            content: {
              type: 'string',
              description: 'The file content (for text files like .drawio, provide the text content directly)',
            },
            contentType: {
              type: 'string',
              description: 'MIME type (default: application/octet-stream, for draw.io use application/vnd.jgraph.mxfile)',
            },
          },
          required: ['pageId', 'filename', 'content'],
        },
      },
      {
        name: 'confluence_update_diagram',
        description: 'Update a draw.io diagram and automatically replace all links on the page. This uploads the updated diagram as a new file (with -UPDATED suffix) and updates all references on the page to point to the new version.',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'The ID of the page containing the diagram',
            },
            filename: {
              type: 'string',
              description: 'The current filename of the diagram (e.g., diagram.drawio)',
            },
            content: {
              type: 'string',
              description: 'The updated diagram content (XML)',
            },
          },
          required: ['pageId', 'filename', 'content'],
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

      case 'confluence_download_attachment': {
        const result = await downloadAttachment(args.pageId, args.attachmentId);
        return {
          content: [
            {
              type: 'text',
              text: `Content-Type: ${result.contentType}\nSize: ${result.size} bytes\n\n${result.content}`,
            },
          ],
        };
      }

      case 'confluence_upload_attachment': {
        const result = await uploadAttachment(
          args.pageId,
          args.filename,
          args.content,
          args.contentType
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

      case 'confluence_update_diagram': {
        const result = await updateDiagramWithLinks(
          args.pageId,
          args.filename,
          args.content
        );
        return {
          content: [
            {
              type: 'text',
              text: `✅ Diagram updated successfully!\n\nNew file: ${result.newFilename}\nAttachment ID: ${result.newAttachmentId}\nLinks replaced: ${result.replacedLinksCount}\nPage version: ${result.pageVersion}\n\nAll references on the page now point to the updated diagram.`,
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
