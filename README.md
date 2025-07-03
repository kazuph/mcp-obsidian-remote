# MCP Obsidian Remote

A Model Context Protocol (MCP) client that connects to Obsidian Local REST API, with an embedded Rust-based API server as an alternative implementation.

## Architecture

- **MCP Client** (TypeScript): Published as npm package for Claude Code integration
- **API Server** (Rust): Alternative implementation of Obsidian Local REST API

## Directory Structure

```
mcp-obsidian-remote/
├── src/                    # MCP Client (TypeScript)
├── server/                 # API Server (Rust)
├── package.json           # MCP Client package configuration
└── README.md
```

## Features

### MCP Client
- Connects to Obsidian Local REST API via HTTP/HTTPS
- API key authentication support
- Network-based communication for remote Obsidian access
- Full MCP protocol implementation

### API Server
- Rust implementation of Obsidian Local REST API
- Self-signed certificate generation
- Vault file management
- Compatible with original Obsidian plugin API

## Development

### MCP Client
```bash
npm install
npm run dev
```

### API Server
```bash
cd server
cargo run
```

## Installation

### As MCP Server
```bash
npm install -g mcp-obsidian-remote
```

### As Standalone API Server
```bash
cd server
cargo build --release
```