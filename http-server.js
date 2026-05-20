#!/usr/bin/env node

/**
 * Confluence MCP HTTP Server
 * HTTP wrapper for stdio-based Confluence MCP server
 */

import express from 'express';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'confluence-mcp-http' });
});

/**
 * MCP endpoint - proxies requests to stdio MCP server
 */
app.post('/mcp', async (req, res) => {
  const mcpServer = spawn('node', [resolve(__dirname, 'index.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env
  });

  let output = '';
  let error = '';

  mcpServer.stdout.on('data', (data) => {
    output += data.toString();
  });

  mcpServer.stderr.on('data', (data) => {
    error += data.toString();
  });

  mcpServer.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error('MCP server error:', error);
      return res.status(500).json({
        error: 'MCP server failed',
        details: error,
        code
      });
    }

    // Find JSON response in output (skip server startup messages)
    const lines = output.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('{') && trimmed.includes('"jsonrpc"');
    });

    if (lines.length > 0) {
      try {
        const response = JSON.parse(lines[lines.length - 1]);
        res.json(response);
      } catch (e) {
        console.error('Failed to parse MCP response:', e);
        res.status(500).json({
          error: 'Invalid JSON response',
          details: e.message,
          output: lines[lines.length - 1]
        });
      }
    } else {
      console.error('No valid JSON response from MCP server');
      res.status(500).json({
        error: 'No valid response from MCP server',
        output: output,
        stderr: error
      });
    }
  });

  mcpServer.on('error', (err) => {
    console.error('Failed to start MCP server:', err);
    res.status(500).json({
      error: 'Failed to start MCP server',
      details: err.message
    });
  });

  // Send request to MCP server
  mcpServer.stdin.write(JSON.stringify(req.body) + '\n');
  mcpServer.stdin.end();
});

const PORT = process.env.PORT || 3456;

app.listen(PORT, () => {
  console.log(`Confluence MCP HTTP server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
