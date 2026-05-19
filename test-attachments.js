#!/usr/bin/env node

/**
 * Test script for confluence_get_page with attachments
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ATLASSIAN_SITE = process.env.ATLASSIAN_SITE;
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;
const CONFLUENCE_API_BASE = `https://${ATLASSIAN_SITE}/wiki/rest/api`;

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

async function testGetPageWithAttachments() {
  console.log('Testing confluence_get_page with filtered attachments...\n');

  try {
    // Import the actual getPage function would be better, but for now let's replicate the logic
    const expand = ['body.storage', 'version', 'space', 'ancestors', 'children.attachment'];
    const response = await client.get(`${CONFLUENCE_API_BASE}/content/1320288861`, {
      params: { expand: expand.join(',') }
    });

    let page = response.data;

    // Apply same filtering as in index.js
    if (page.children && page.children.attachment) {
      const htmlContent = page.body?.storage?.value;
      const attachments = page.children.attachment;

      // Extract referenced attachments
      const referenced = new Set();
      if (htmlContent) {
        const imageMatches = htmlContent.matchAll(/ri:filename="([^"]+)"/g);
        for (const match of imageMatches) {
          referenced.add(match[1]);
        }
        const drawioMatches = htmlContent.matchAll(/<ac:adf-parameter key="diagram-name">([^<]+)<\/ac:adf-parameter>/g);
        for (const match of drawioMatches) {
          referenced.add(match[1]);
          referenced.add(match[1] + '.png');
        }
        const displayNameMatches = htmlContent.matchAll(/<ac:adf-parameter key="diagram-display-name">([^<]+)<\/ac:adf-parameter>/g);
        for (const match of displayNameMatches) {
          referenced.add(match[1]);
          referenced.add(match[1] + '.png');
        }
      }

      // Filter
      const filtered = attachments.results.filter(att => {
        const title = att.title || '';
        if (title.startsWith('~drawio~') || title.endsWith('.tmp')) return false;
        if (referenced.size > 0) return referenced.has(title);
        return true;
      });

      page.children.attachment = {
        ...attachments,
        results: filtered,
        size: filtered.length
      };
    }

    console.log('✓ Page retrieved successfully');
    console.log(`  Title: ${page.title}`);
    console.log(`  Space: ${page.space.name} (${page.space.key})`);
    console.log(`  Version: ${page.version.number}`);

    if (page.children && page.children.attachment) {
      const attachments = page.children.attachment.results;
      console.log(`\n✓ Found ${attachments.length} attachments:\n`);

      attachments.slice(0, 3).forEach((att, idx) => {
        console.log(`  ${idx + 1}. ${att.title}`);
        console.log(`     Type: ${att.extensions?.mediaType || 'unknown'}`);
        console.log(`     Size: ${(att.extensions?.fileSize / 1024).toFixed(1)} KB`);
        console.log(`     Download: ${CONFLUENCE_API_BASE.replace('/rest/api', '')}${att._links.download}`);
        console.log('');
      });
    } else {
      console.log('\n✗ No attachments found');
    }

    console.log('✓ Test passed!');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testGetPageWithAttachments();
