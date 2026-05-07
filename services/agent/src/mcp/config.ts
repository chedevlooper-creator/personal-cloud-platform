/**
 * MCP server configuration management.
 *
 * Currently env-based; can be extended to load per-user configs from the DB.
 */

export interface MCPServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  type: 'stdio' | 'sse';
}

export function loadMcpConfigs(): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  // Example: MCP_SERVERS='{"name":"filesystem","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/tmp"]}'
  const raw = process.env.MCP_SERVERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MCPServerConfig | MCPServerConfig[];
      if (Array.isArray(parsed)) {
        configs.push(...parsed);
      } else {
        configs.push(parsed);
      }
    } catch {
      // ignore invalid env
    }
  }

  return configs;
}
