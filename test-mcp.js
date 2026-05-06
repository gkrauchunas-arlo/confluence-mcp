#!/usr/bin/env node

/**
 * Test Confluence MCP Server locally
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

console.log('🧪 Testing Confluence MCP Server\n');

async function testMCPServer() {
  console.log('Starting MCP server...');

  // Spawn the server process
  const serverProcess = spawn('node', ['./index.js'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env
  });

  // Create transport
  const transport = new StdioClientTransport({
    reader: serverProcess.stdout,
    writer: serverProcess.stdin,
  });

  // Create client
  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // List tools
    console.log('📋 Listing available tools...');
    const tools = await client.listTools();

    console.log(`Found ${tools.tools.length} tools:\n`);
    tools.tools.forEach((tool) => {
      console.log(`  • ${tool.name}`);
      console.log(`    ${tool.description.substring(0, 80)}...`);
    });

    // Test list spaces
    console.log('\n🔍 Testing confluence_list_spaces...');
    const listResult = await client.callTool({
      name: 'confluence_list_spaces',
      arguments: { limit: 3 },
    });

    console.log('✅ Success!');
    const listData = JSON.parse(listResult.content[0].text);
    console.log(`Found ${listData.results?.length || 0} spaces`);
    if (listData.results && listData.results.length > 0) {
      console.log(`First space: ${listData.results[0].name} (${listData.results[0].key})`);
    }

    // Test search
    console.log('\n🔍 Testing confluence_search...');
    const searchResult = await client.callTool({
      name: 'confluence_search',
      arguments: {
        query: 'type=page',
        limit: 3
      },
    });

    console.log('✅ Success!');
    const searchData = JSON.parse(searchResult.content[0].text);
    console.log(`Found ${searchData.results?.length || 0} pages`);
    if (searchData.results && searchData.results.length > 0) {
      console.log(`First page: ${searchData.results[0].title} (ID: ${searchData.results[0].id})`);

      // Test get page
      const pageId = searchData.results[0].id;
      console.log(`\n🔍 Testing confluence_get_page with ID ${pageId}...`);
      const pageResult = await client.callTool({
        name: 'confluence_get_page',
        arguments: { pageId },
      });

      console.log('✅ Success!');
      const pageData = JSON.parse(pageResult.content[0].text);
      console.log(`Page title: ${pageData.title}`);
      console.log(`Page version: ${pageData.version?.number || 'N/A'}`);
    }

    console.log('\n🎉 All tests passed!');

    await client.close();
    serverProcess.kill();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    serverProcess.kill();
    process.exit(1);
  }
}

testMCPServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
