#!/usr/bin/env node

/**
 * Test Confluence REST API v3 connectivity
 * Run this to verify your credentials work before running the MCP server
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ATLASSIAN_SITE = process.env.ATLASSIAN_SITE;
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;

if (!ATLASSIAN_SITE || !ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('ERROR: Missing required environment variables');
  console.error('Please set ATLASSIAN_SITE, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN in .env');
  process.exit(1);
}

const BASE_URL = `https://${ATLASSIAN_SITE}/wiki/rest/api`;

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

console.log('Testing Confluence API connectivity...');
console.log(`Site: ${ATLASSIAN_SITE}`);
console.log(`Email: ${ATLASSIAN_EMAIL}`);
console.log('');

async function testListSpaces() {
  console.log('Test 1: List Spaces');
  try {
    const response = await client.get(`${BASE_URL}/space`, {
      params: { limit: 5 }
    });
    console.log('✅ Success! Found', response.data.results?.length || 0, 'spaces');
    if (response.data.results && response.data.results.length > 0) {
      console.log('   First space:', response.data.results[0].name, `(${response.data.results[0].key})`);
    }
    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testSearchPages() {
  console.log('\nTest 2: Search Pages (CQL)');
  try {
    const response = await client.get(`${BASE_URL}/content/search`, {
      params: {
        cql: 'type=page',
        limit: 5
      }
    });
    console.log('✅ Success! Found', response.data.results?.length || 0, 'pages');
    if (response.data.results && response.data.results.length > 0) {
      const page = response.data.results[0];
      console.log('   First page:', page.title, `(ID: ${page.id})`);
      return page.id;
    }
    return null;
  } catch (error) {
    console.error('❌ Failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testGetPage(pageId) {
  if (!pageId) {
    console.log('\nTest 3: Get Page - SKIPPED (no page ID)');
    return;
  }

  console.log(`\nTest 3: Get Page by ID (${pageId})`);
  try {
    const response = await client.get(`${BASE_URL}/content/${pageId}`, {
      params: {
        expand: 'body.storage,version,space'
      }
    });
    console.log('✅ Success!');
    console.log('   Title:', response.data.title);
    console.log('   Space:', response.data.space?.name);
    console.log('   Version:', response.data.version?.number);
  } catch (error) {
    console.error('❌ Failed:', error.response?.data?.message || error.message);
  }
}

async function testGetSpace(spaceKey) {
  if (!spaceKey) {
    console.log('\nTest 4: Get Space - SKIPPED (no space key)');
    return;
  }

  console.log(`\nTest 4: Get Space (${spaceKey})`);
  try {
    const response = await client.get(`${BASE_URL}/space/${spaceKey}`);
    console.log('✅ Success!');
    console.log('   Name:', response.data.name);
    console.log('   Type:', response.data.type);
  } catch (error) {
    console.error('❌ Failed:', error.response?.data?.message || error.message);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('CONFLUENCE API TESTS');
  console.log('='.repeat(60));
  console.log('');

  const spaces = await testListSpaces();
  const pageId = await testSearchPages();
  await testGetPage(pageId);

  if (spaces && spaces.length > 0) {
    await testGetSpace(spaces[0].key);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Tests complete!');
  console.log('='.repeat(60));
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
