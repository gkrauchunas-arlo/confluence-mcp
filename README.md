# Confluence MCP Server

Model Context Protocol (MCP) server for Atlassian Confluence integration with Claude Code.

## Features

- 🔍 **Search** across Confluence pages using CQL (Confluence Query Language)
- 📄 **Read** pages by ID or title
- ✏️ **Create and update** pages
- 🏷️ **Manage labels** and metadata
- 📁 **List spaces** and attachments
- 🔐 **Secure** Basic Auth with API tokens

## Installation

### Prerequisites
- Node.js 18+ and npm
- Atlassian Confluence Cloud account
- API token (see Configuration below)

### Setup
```bash
git clone https://github.com/gkrauchunas-arlo/confluence-mcp.git
cd confluence-mcp
npm install
```

### Configuration
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Atlassian credentials in `.env`:
   ```env
   ATLASSIAN_SITE=your-domain.atlassian.net
   ATLASSIAN_EMAIL=your-email@example.com
   ATLASSIAN_API_TOKEN=your-token
   ```

**Getting an API token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name (e.g., "Claude Code MCP") and copy the token to `.env`

### Testing
```bash
# Test Confluence API connectivity
node test-confluence.js

# Test MCP protocol (via stdio)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"0.1.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node index.js
```

## Connecting to Claude Code

### Option 1: CLI (Recommended)
```bash
claude mcp add --transport stdio confluence \
  --env ATLASSIAN_SITE="your-domain.atlassian.net" \
  --env ATLASSIAN_EMAIL="your-email@example.com" \
  --env ATLASSIAN_API_TOKEN="your-token" \
  -- node /absolute/path/to/confluence-mcp/index.js
```

Replace `/absolute/path/to/` with your actual installation path (e.g., `/home/username/confluence-mcp`).

### Option 2: Configuration File
Add to your Claude Code MCP configuration file:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "node",
      "args": ["/absolute/path/to/confluence-mcp/index.js"],
      "env": {
        "ATLASSIAN_SITE": "your-domain.atlassian.net",
        "ATLASSIAN_EMAIL": "your-email@example.com",
        "ATLASSIAN_API_TOKEN": "your-token"
      }
    }
  }
}
```

**Configuration file locations:**
- Linux: `~/.config/claude-code/mcp_servers.json` or `~/.claude/config/mcp_servers.json`
- macOS: `~/Library/Application Support/claude-code/mcp_servers.json`
- Windows: `%APPDATA%\claude-code\mcp_servers.json`

After configuration, restart Claude Code to activate the MCP server.

## Available Tools

### Search & Navigation
- **`confluence_search`** - CQL search across all content
  - Parameters: `query` (string), `limit` (number, optional), `spaceKey` (string, optional)
  - Example: Search for pages with "API" in title within a specific space

- **`confluence_list_spaces`** - List all spaces
  - Parameters: `limit` (number, optional, default: 25)
  - Returns: List of all Confluence spaces accessible to your account

### Read Content
- **`confluence_get_page`** - Get page by ID
  - Parameters: `pageId` (string)
  - Returns: Complete page data including content, version, and metadata

- **`confluence_get_page_by_title`** - Find page by title and space
  - Parameters: `title` (string), `spaceKey` (string)
  - Returns: Page matching the exact title in the specified space

- **`confluence_get_space`** - Get space information
  - Parameters: `spaceKey` (string)
  - Returns: Space metadata and configuration

- **`confluence_get_attachments`** - List page attachments
  - Parameters: `pageId` (string)
  - Returns: List of all attachments on a page

### Create & Edit
- **`confluence_create_page`** - Create a new page
  - Parameters: `title` (string), `spaceKey` (string), `content` (HTML string), `parentId` (string, optional)
  - Creates a new page in the specified space, optionally as a child of another page

- **`confluence_update_page`** - Update existing page
  - Parameters: `pageId` (string), `title` (string), `content` (HTML string), `version` (number)
  - Updates a page with new content. Version number must match the current page version.

### Metadata
- **`confluence_add_labels`** - Add labels to a page
  - Parameters: `pageId` (string), `labels` (array of strings)
  - Adds one or more labels/tags to a page for categorization

## Usage Examples

Once connected to Claude Code, you can use natural language to interact with Confluence:

### Search for pages
```
Find all pages about "API documentation" in Confluence
```

### Read a page
```
Read the contents of Confluence page with ID 12345
```

### Create a new page
```
Create a new page in the DEV space titled "API Guidelines" with this content:
<h1>API Guidelines</h1>
<p>This document describes our API design principles.</p>
```

### Update a page
```
Update Confluence page 12345 to add a new section about authentication
```

### Add labels
```
Add labels "documentation" and "api" to Confluence page 12345
```

## CQL Query Examples

The `confluence_search` tool supports [Confluence Query Language (CQL)](https://developer.atlassian.com/server/confluence/advanced-searching-using-cql/):

```
type=page AND title~"API"
type=page AND space=DEV
type=page ORDER BY lastmodified DESC
type=page AND label=documentation
type=page AND creator=currentUser()
```

## API Reference

This MCP server uses the **Confluence REST API**:
- Base URL: `https://{site}.atlassian.net/wiki/rest/api`
- Authentication: Basic Auth with email + API token
- API Version: Cloud REST API (stable)
- [Full API Documentation](https://developer.atlassian.com/cloud/confluence/rest/v1/)

## Troubleshooting

### "Authentication failed"
- Verify your email and API token in `.env`
- Ensure the token hasn't expired (API tokens don't expire but can be revoked)
- Check you're using an **API token**, not your Atlassian account password

### "MCP tools not showing up"
- Restart Claude Code completely (close and reopen)
- Check server logs for errors by running `node index.js` directly
- Verify configuration with `claude mcp list`
- Ensure the full absolute path is used in the configuration

### "Permission denied" errors
- Ensure your Atlassian account has access to the requested spaces/pages
- Some operations require specific permissions (e.g., space admin for creating pages)
- Check space permissions in Confluence web UI

### "Page version conflict"
- When updating a page, you must provide the current version number
- Get the current version with `confluence_get_page` first
- The server will automatically increment the version by 1

## Content Format

Confluence pages use **Storage Format** (HTML with Confluence macros). For simple pages, standard HTML works:

```html
<h1>Heading</h1>
<p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
<ul>
  <li>Bullet point 1</li>
  <li>Bullet point 2</li>
</ul>
<pre><code>Code block</code></pre>
```

For advanced features, see [Confluence Storage Format documentation](https://confluence.atlassian.com/doc/confluence-storage-format-790796544.html).

## Architecture

Built on:
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP protocol implementation
- [axios](https://axios-http.com/) - HTTP client for Confluence REST API
- [dotenv](https://github.com/motdotla/dotenv) - Configuration management

The server runs as a stdio-based MCP server, communicating with Claude Code via JSON-RPC 2.0 over standard input/output.

## Development

### Project Structure
```
confluence-mcp/
├── index.js              # Main MCP server implementation
├── package.json          # Dependencies and scripts
├── test-confluence.js    # Confluence API connectivity tests
├── test-mcp.js           # MCP protocol tests (WIP)
├── .env.example          # Example configuration
├── .env                  # Your configuration (gitignored)
└── README.md             # This file
```

### Running Tests
```bash
# Test Confluence API directly
node test-confluence.js

# Test MCP server via stdio
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"0.1.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node index.js
```

### Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Commit your changes (`git commit -m 'feat: add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Known Limitations

1. **Attachment uploads** - Not yet implemented (requires multipart/form-data encoding)
2. **Rich text formatting** - Only basic HTML supported, Confluence macros can be complex
3. **Pagination** - Large result sets are limited by the `limit` parameter
4. **Permissions** - API returns only content accessible to the authenticated user

## License

ISC

## Acknowledgments

- Architecture inspired by [rovo-mcp](https://github.com/gkrauchunas-arlo/rovo-mcp)
- Built for [Claude Code](https://claude.ai/code)
- Uses the [Model Context Protocol](https://modelcontextprotocol.io/)

## Support

- **Issues**: https://github.com/gkrauchunas-arlo/confluence-mcp/issues
- **Atlassian API Docs**: https://developer.atlassian.com/cloud/confluence/rest/
- **MCP Specification**: https://modelcontextprotocol.io/specification

---

**Created by**: [gkrauchunas-arlo](https://github.com/gkrauchunas-arlo)  
**Status**: Stable v1.0.0 - All core features implemented and tested
