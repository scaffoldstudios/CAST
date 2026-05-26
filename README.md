# CAST — Coordinated Agent Swarm Testing

Orchestrate a swarm of Claude AI agents to perform systematic code analysis on any codebase. Each agent brings a unique testing persona — from XSS hunters to memory leak detectives — working across 5 specialized squads to find bugs, security vulnerabilities, and code quality issues.

**Free and open source.** Built for Claude (Anthropic's API). By [Scaffold Studios](https://scaffoldstudios.com/cast).

## How It Works

CAST deploys multiple Claude agents organized into 5 analysis squads:

| Squad | Focus |
|-------|-------|
| **Security Auditors** | XSS, injection, auth bypass, secrets exposure, unsafe deserialization |
| **Logic Analysts** | Off-by-one errors, state bugs, race conditions, wrong conditionals |
| **Robustness Testers** | Null safety, error handling, edge cases, boundary conditions |
| **Performance Engineers** | Memory leaks, O(n^2) algorithms, unbounded growth, missing cleanup |
| **Data Integrity Inspectors** | Serialization fidelity, type safety, state consistency |

Each squad contains agents with distinct personas and methodologies. Findings are deduplicated across agents using Jaccard similarity matching, and cross-squad corroboration boosts confidence scores.

## Quick Start

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Quick 5-agent scan (~$0.40)
npx cast-swarm --src ./src

# Moderate 20-agent scan (~$1.60)
npx cast-swarm --src ./src --agents 20

# Full 100-agent analysis (~$8)
npx cast-swarm --src ./src --full

# View results
npx cast-swarm --report
```

## Installation

**Requires:** An [Anthropic API key](https://console.anthropic.com/) (`ANTHROPIC_API_KEY`)

```bash
# Global install
npm install -g cast-swarm

# Or use directly with npx
npx cast-swarm --src ./src
```

## CLI Options

```
cast-swarm [options]

Options:
  --src <dir>          Source directory to scan (default: current directory)
  --agents <n>         Number of agents to deploy (default: 5)
  --full               Full 100-agent analysis (~$8)
  --dry-run            Quick 5-agent scan (1 per squad)
  --model <model>      Claude model to use (default: claude-sonnet-4-20250514)
  --output <dir>       Output directory (default: <src>/.cast-output)
  --concurrency <n>    Max concurrent agents (default: 4)
  --squad <id>         Run only one squad (security|logic|robustness|performance|data-integrity)
  --config <path>      Path to cast.config.json
  --report             View results from last run
  --help               Show this help message
  --version            Show version
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | **Required.** Your Anthropic API key |
| `CAST_MODEL` | Override default model |
| `CAST_AGENTS` | Override default agent count |
| `CAST_CONCURRENCY` | Override default concurrency |
| `CAST_OUTPUT_DIR` | Override default output directory |

## Configuration File

Create `cast.config.json` in your project root for persistent settings:

```json
{
  "model": "claude-sonnet-4-20250514",
  "agentCount": 20,
  "concurrency": 4,
  "appName": "My App",
  "appDescription": "A web application for managing widgets",
  "exclude": ["__tests__", "fixtures"],
  "include": [".ts", ".tsx"]
}
```

## MCP Server (Claude Code / Claude Desktop)

CAST can run as an MCP server, giving Claude direct access to code analysis tools.

### Claude Code

```bash
claude mcp add cast-swarm npx cast-swarm-mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cast-swarm": {
      "command": "npx",
      "args": ["-y", "cast-swarm-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

### MCP Tools

| Tool | Description | Cost |
|------|-------------|------|
| `cast_scan` | Quick analysis with configurable agent count | ~$0.40 (5 agents) |
| `cast_full` | Full 100-agent comprehensive analysis | ~$8 |
| `cast_report` | Read results from a previous analysis | Free |

## Output

Reports are saved to `.cast-output/` in your project:

```
project/.cast-output/
  cast-report.json        # Full JSON with all findings and raw results
  cast-dashboard.md       # Human-readable markdown dashboard
```

### Report Structure

The JSON report includes:
- **Findings**: Deduplicated, severity-sorted, with confidence scores
- **Squad stats**: Per-squad agent counts, success rates, severity breakdowns
- **File heatmap**: Which files have the most findings
- **Raw results**: Individual agent outputs for detailed review
- **Metadata**: Cost, token usage, timing, model info

## Supported Languages

CAST analyzes source files with these extensions:

`.ts` `.tsx` `.js` `.jsx` `.py` `.go` `.rs` `.java` `.kt` `.rb` `.php` `.c` `.cpp` `.h` `.hpp` `.cs` `.swift` `.scala` `.vue` `.svelte`

## How Deduplication Works

Multiple agents often find the same bug. CAST deduplicates using:

1. **File + Category grouping**: Findings in the same file and category are candidates for merging
2. **Line proximity**: Findings within 15 lines of each other
3. **Title similarity**: Jaccard similarity of title keywords (threshold: 0.25)
4. **Cross-squad scoring**: Findings reported by multiple squads get higher confidence

## Cost Estimates

| Agent Count | Approximate Cost | Use Case |
|-------------|-----------------|----------|
| 5 | ~$0.40 | Quick scan, CI/CD |
| 20 | ~$1.60 | Moderate review |
| 50 | ~$4.00 | Thorough analysis |
| 100 | ~$8.00 | Comprehensive audit |

Costs vary based on codebase size. Estimates assume claude-sonnet-4-20250514.

## License

Apache 2.0 — See [LICENSE](LICENSE) and [NOTICE](NOTICE) for full terms.
