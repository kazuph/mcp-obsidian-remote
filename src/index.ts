#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ObsidianApiClient } from "./obsidian-client.js";

interface ServerConfig {
  baseUrl: string;
  apiKey: string;
  rejectUnauthorized?: boolean;
}

class ObsidianMcpServer {
  private server: Server;
  private obsidianClient: ObsidianApiClient;

  constructor() {
    this.server = new Server(
      {
        name: "@kazuph/mcp-obsidian-remote",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "obsidian_get_vault_files",
            description: "List all files in the Obsidian vault",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to list files from (optional, defaults to root)",
                  default: ""
                }
              },
            },
          },
          {
            name: "obsidian_read_file",
            description: "Read content from a file in the Obsidian vault",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file to read (relative to vault root)",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "obsidian_write_file",
            description: "Write content to a file in the Obsidian vault",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file to write (relative to vault root)",
                },
                content: {
                  type: "string",
                  description: "Content to write to the file",
                },
              },
              required: ["path", "content"],
            },
          },
          {
            name: "obsidian_append_file",
            description: "Append content to a file in the Obsidian vault",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file to append to (relative to vault root)",
                },
                content: {
                  type: "string",
                  description: "Content to append to the file",
                },
              },
              required: ["path", "content"],
            },
          },
          {
            name: "obsidian_delete_file",
            description: "Delete a file from the Obsidian vault",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file to delete (relative to vault root)",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "obsidian_get_active_file",
            description: "Get the currently active file in Obsidian",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "obsidian_open_file",
            description: "Open a file in Obsidian",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file to open (relative to vault root)",
                },
                newLeaf: {
                  type: "boolean",
                  description: "Open in a new leaf/tab",
                  default: false,
                },
              },
              required: ["path"],
            },
          },
          {
            name: "obsidian_search_files",
            description: "Search for files in the Obsidian vault",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query",
                },
              },
              required: ["query"],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.obsidianClient) {
        throw new Error("Obsidian client not configured. Please set OBSIDIAN_BASE_URL and OBSIDIAN_API_KEY environment variables.");
      }

      try {
        switch (name) {
          case "obsidian_get_vault_files":
            const files = await this.obsidianClient.getVaultFiles(args.path || "");
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(files, null, 2),
                },
              ],
            };

          case "obsidian_read_file":
            const content = await this.obsidianClient.readFile(args.path);
            return {
              content: [
                {
                  type: "text",
                  text: content,
                },
              ],
            };

          case "obsidian_write_file":
            await this.obsidianClient.writeFile(args.path, args.content);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully wrote to ${args.path}`,
                },
              ],
            };

          case "obsidian_append_file":
            await this.obsidianClient.appendFile(args.path, args.content);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully appended to ${args.path}`,
                },
              ],
            };

          case "obsidian_delete_file":
            await this.obsidianClient.deleteFile(args.path);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully deleted ${args.path}`,
                },
              ],
            };

          case "obsidian_get_active_file":
            const activeFile = await this.obsidianClient.getActiveFile();
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(activeFile, null, 2),
                },
              ],
            };

          case "obsidian_open_file":
            await this.obsidianClient.openFile(args.path, args.newLeaf);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully opened ${args.path}`,
                },
              ],
            };

          case "obsidian_search_files":
            const searchResults = await this.obsidianClient.searchFiles(args.query);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(searchResults, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async run() {
    // Initialize Obsidian client from environment variables
    const baseUrl = process.env.OBSIDIAN_BASE_URL;
    const apiKey = process.env.OBSIDIAN_API_KEY;
    const rejectUnauthorized = process.env.OBSIDIAN_REJECT_UNAUTHORIZED !== "false";

    if (!baseUrl || !apiKey) {
      console.error("Please set OBSIDIAN_BASE_URL and OBSIDIAN_API_KEY environment variables");
      process.exit(1);
    }

    this.obsidianClient = new ObsidianApiClient({
      baseUrl,
      apiKey,
      rejectUnauthorized,
    });

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Obsidian MCP Server running on stdio");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ObsidianMcpServer();
  server.run().catch((error) => {
    console.error("Server failed:", error);
    process.exit(1);
  });
}