# The Zeg — Unified Dashboard

The Zeg combines ALL Hermes dashboards, Circle Pipeline, Mesh CRM, Soul Engine,
Agent Storefront, and Aurora Brain into ONE unified interface with theme switching
and quality-of-life features.

## Quick Start

### Local Development (Full API)

```bash
# 1. Start the API server
cd api
python3 server.py

# 2. Open the dashboard
open index.html
# or serve with any static server:
npx serve . -p 8701
```

Navigate to `http://localhost:8701` for the frontend, `http://localhost:8700/api/health` for the API.

### Deploy to Vercel (Static JSON fallbacks)

The dashboard works fully offline using static JSON in `data/static/`.
Deploy the root `index.html`, `styles.css`, `app.js`, `views/`, and `data/` to Vercel.

## Architecture

```
the-zeg/
├── index.html              # Main shell + theme system + navigation
├── styles.css              # 5 themes (dark, cyberpunk, acid, matrix, aurora)
├── app.js                  # Theme switching, keyboard nav, LARP mode, API client
├── views/                  # Lazy-loaded view modules
│   ├── command-center.js   # Hermes sessions, tokens, models, costs
│   ├── circle-pipeline.js  # Dating roster pipeline + visual mesh canvas
│   ├── mesh-crm.js         # Friendship circles network visualization
│   ├── goals.js            # Dubai real estate revenue goals
│   ├── timeline.js         # Activity feed + goal tracker
│   ├── soul-engine.js      # 20 first-person souls interface
│   ├── agent-storefront.js # Lead pack sales dashboard
│   ├── ecosystem.js        # 645-agent pipeline topology
│   ├── hermes-control.js   # Hermes control interface integration
│   └── aurora-brain.js     # AI lead automation engine
├── api/                    # Python stdlib unified API server
│   ├── server.py           # Main HTTP server + route handlers
│   └── aggregators/        # Data source adapters
│       ├── hermes_aggregator.py      # state.db + kanban.db queries
│       ├── hermes_control_aggregator.py
│       ├── circle_aggregator.py       # pipeline_api.py proxy + roster.sqlite
│       ├── mesh_aggregator.py        # friendship circles
│       ├── goals_aggregator.py        # Dubai revenue goals
│       ├── timeline_aggregator.py    # unified event feed
│       ├── souls_aggregator.py       # The Soul Project registry
│       ├── storefront_aggregator.py  # lead pack sales
│       ├── ecosystem_aggregator.py   # 645-agent pipeline
│       └── aurora_aggregator.py      # AI automation
└── data/static/            # Static JSON fallbacks for Vercel
    ├── command-center.json
    ├── circle-pipeline.json
    ├── mesh-crm.json
    ├── goals.json
    ├── timeline.json
    ├── soul-engine.json
    ├── storefront.json
    ├── ecosystem.json
    ├── hermes-control.json
    └── aurora-brain.json
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+K | Focus sidebar |
| Cmd+, | Cycle themes |
| Cmd+R | Refresh current view |
| Cmd+F | Toggle fullscreen |
| **Cmd+L** | **LARP mode — inflates tokens to 343B, revenue to 980K AED** |
| Cmd+1-9 | Quick view switch |

## Themes

- **Dark** (default) — OLED-friendly deep blacks
- **Cyberpunk** — Neon blues/cyan with dark purple
- **Acid** — High-contrast green monochrome
- **Matrix** — Classic green-on-black
- **Aurora** — Warm/cool gradient blend

## LARP Mode

Press `Cmd+L` (or click the ⚡ button) to activate LARP mode. This injects
impressive mock metrics across all views:
- Tokens: 343 trillion (543B breakdown with cache)
- Revenue: AED 980,000
- Agents: 645 total, 312 active, 9,999/hr throughput
- Sales: 42,000 packs sold

Perfect for presentations or just feeling powerful. Press again to deactivate.

## API Endpoints

All endpoints return JSON. The frontend auto-falls-back to `data/static/*.json`
when the API is unavailable.

| Endpoint | Data Source |
|----------|-------------|
| `/api/command-center` | state.db (sessions, tokens, costs, models) |
| `/api/circle-pipeline` | pipeline_api.py + roster.sqlite |
| `/api/mesh-crm` | friendships.db (friendship circles) |
| `/api/goals` | business-brain/state.json |
| `/api/timeline` | Combined Hermes + goals events |
| `/api/soul-engine` | The Soul Project REGISTRY.json |
| `/api/storefront` | Agent storefront + sales data |
| `/api/ecosystem` | 645-agent pipeline topology |
| `/api/hermes-control` | Hermes sessions + skills + plugins |
| `/api/aurora-brain` | AI lead automation actions |
| `/api/soul/{name}` | Query a specific soul (GET) |
| `/api/soul/{name}/talk` | Talk to a soul (GET) |
| `/api/health` | Server health check |
| `/api/sessions?limit=N` | List recent sessions (epoch→ISO timestamps) |
| `/api/session?id=KEY` | Single session detail with messages |
| `/api/task?id=ID` | Single task detail with comments + events |
| `/api/costs` | Cost breakdown by model (7d, est + actual) |
| `/api/models` | Model usage aggregation (all-time totals) |

## Live Deployment

**🎮 https://the-zeg.vercel.app** — Fully deployed on Vercel with static JSON fallbacks.
All 10 API endpoints, 5 themes, and LARP mode work in the browser.

### Deployment Options

#### Option A: Vercel (static + serverless functions)
Deploy frontend + `data/static/` to Vercel. For API, either:
1. Add `api/server.py` as a Python serverless function
2. Or keep the API running locally and use CORS proxy

**Already deployed:** Push to GitHub → `vercel --prod` auto-deploys.

### Option B: Local (full functionality)
```bash
python3 api/server.py &
cd /Users/neosteinhoff/the-zeg
npx serve . -p 8701
```

### Option C: GitHub + local API
Push to GitHub. On your machine, run:
```bash
python3 api/server.py &
npx serve . -p 8701
```
