#!/usr/bin/env node

/**
 * Helper script to call Confluence MCP tools directly
 * Usage: node mcp-call.js <tool-name> <json-params>
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const [,, toolName, ...args] = process.argv;

if (!toolName) {
  console.error('Usage: node mcp-call.js <tool-name> [json-params]');
  console.error('Example: node mcp-call.js confluence_get_page \'{"pageId":"1320288861"}\'');
  process.exit(1);
}

const params = args.length > 0 ? JSON.parse(args.join(' ')) : {};

// Create MCP request
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: toolName,
    arguments: params
  }
};

// Start MCP server
const mcpServer = spawn('node', [resolve(__dirname, 'index.js')], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let output = '';

mcpServer.stdout.on('data', (data) => {
  output += data.toString();
});

mcpServer.on('close', (code) => {
  try {
    // Find JSON response in output
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        const response = JSON.parse(line);
        if (response.result) {
          console.log(JSON.stringify(response.result, null, 2));
        } else if (response.error) {
          console.error('Error:', response.error);
          process.exit(1);
        }
        break;
      }
    }
  } catch (err) {
    console.error('Failed to parse response:', err.message);
    console.error('Raw output:', output);
    process.exit(1);
  }
});

// Send request to MCP server
mcpServer.stdin.write(JSON.stringify(request) + '\n');
mcpServer.stdin.end();
