#!/usr/bin/env node
'use strict';

// token-calendar-mcp
// A tiny MCP (Model Context Protocol) server that lets Claude answer questions
// about your own token spend — "how much did I burn this month?" — by reading
// Claude Code's local logs (~/.claude/projects). It reuses the same aggregation
// as export-usage.js. Cost is estimated from public list prices, not a bill.
//
// Add it to Claude Code:
//   claude mcp add token-calendar -- npx -y token-calendar-export token-calendar-mcp
// or, from a local clone:
//   claude mcp add token-calendar -- node /absolute/path/to/mcp-server.js

let Server, StdioServerTransport, ListToolsRequestSchema, CallToolRequestSchema;
try {
  ({ Server } = require('@modelcontextprotocol/sdk/server/index.js'));
  ({ StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js'));
  ({ ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js'));
} catch {
  process.stderr.write(
    'token-calendar-mcp needs @modelcontextprotocol/sdk.\n' +
    'Install it:  npm i @modelcontextprotocol/sdk\n'
  );
  process.exit(1);
}

const { aggregate, summarize, fmtTokens } = require('./export-usage.js');

const server = new Server(
  { name: 'token-calendar', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const TOOL = {
  name: 'get_token_usage',
  description:
    "Aggregate the user's Claude Code token usage from local logs (~/.claude/projects). " +
    'Returns per-day tokens, an estimated cost (from public list prices, not a bill), ' +
    'and a summary. Use it to answer questions like how much was spent this month, ' +
    'which day was the peak, or which models were used.',
  inputSchema: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Only include the last N days (optional).' }
    }
  }
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [TOOL] }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== TOOL.name) {
    return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
  }
  const days = req.params.arguments && req.params.arguments.days;
  const { daily, error } = aggregate({ days });
  if (error) return { content: [{ type: 'text', text: error }], isError: true };

  const { dates, tokens, cost } = summarize(daily);
  if (!dates.length) {
    return { content: [{ type: 'text', text: 'No usage rows found in local logs.' }] };
  }

  let peakDay = dates[0], peakCost = 0;
  for (const d of dates) if (daily[d].cost > peakCost) { peakCost = daily[d].cost; peakDay = d; }

  const summary =
    `Token usage${days ? ` (last ${days} days)` : ''}\n` +
    `Range: ${dates[0]} → ${dates[dates.length - 1]}  (${dates.length} active days)\n` +
    `Total: ${fmtTokens(tokens)} tokens, ~$${cost.toFixed(2)} estimated\n` +
    `Peak day: ${peakDay} (~$${peakCost.toFixed(2)})\n` +
    `Cost is estimated from public list prices — see the Anthropic Console for the real bill.\n\n` +
    `Per-day JSON (compatible with Token Calendar import):\n` +
    JSON.stringify(daily, null, 2);

  return { content: [{ type: 'text', text: summary }] };
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('token-calendar MCP server running on stdio\n');
}

run().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
