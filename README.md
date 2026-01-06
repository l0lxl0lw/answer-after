# Answer After

**AI-Powered Call Answering Service Platform**

> Never miss an after-hours call again. Answer After uses intelligent AI to handle customer calls when you're closed, schedule appointments, and capture every revenue opportunity automatically.

## Live Demo

**[View Demo](https://l0lxl0lw.github.io/answer-after/)** - Interactive demo with mock data (no backend required)

## Screenshots

| Dashboard | Call History | Leads |
|-----------|--------------|-------|
| Analytics and KPIs | AI-handled call logs | Lead tracking & scoring |

## Features

- **AI Call Answering** - ElevenLabs conversational AI handles inbound calls 24/7
- **Appointment Scheduling** - Book services directly during calls
- **Lead Capture & Scoring** - Automatically capture and score leads (hot/warm/cold)
- **Multi-tenant SaaS** - Account isolation with role-based access control
- **Real-time Dashboard** - Analytics, call history, and revenue tracking
- **Outbound Campaigns** - Automated reminder and follow-up calls
- **Team Management** - Owner, admin, and staff roles

## Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** - Build tool
- **TailwindCSS** + **shadcn/ui** - Styling & components
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Recharts** - Data visualization
- **Framer Motion** - Animations

### Backend
- **Supabase** - PostgreSQL + Auth + Edge Functions
- **Row-Level Security** - Multi-tenant data isolation
- **Deno** - Edge function runtime

### Integrations
- **ElevenLabs** - Conversational AI agents
- **Twilio** - Phone numbers, voice, SMS
- **Stripe** - Subscription billing

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  Dashboard │ Calls │ Leads │ Appointments │ Settings         │
└─────────────────────────────┬────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │         Supabase              │
              │  ┌─────────────────────────┐  │
              │  │   PostgreSQL + RLS      │  │
              │  │   Edge Functions (40+)  │  │
              │  │   Auth (JWT)            │  │
              │  └─────────────────────────┘  │
              └───────────────┬───────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
  ┌────┴─────┐         ┌──────┴──────┐        ┌─────┴─────┐
  │ElevenLabs│         │   Twilio    │        │  Stripe   │
  │ AI Agent │         │ Phone/SMS   │        │  Billing  │
  └──────────┘         └─────────────┘        └───────────┘
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed documentation.

## Development

### Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run demo mode (mock data, no backend)
npm run dev:demo
```

### Environment Variables

```bash
# Production
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Demo mode
VITE_DEMO_MODE=true
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run dev:demo` | Start with mock data (no backend) |
| `npm run build` | Production build |
| `npm run build:demo` | Build demo version |
| `npm run build:gh-pages` | Build for GitHub Pages |

## Deployment

### GitHub Pages (Demo)

The demo is automatically deployed to GitHub Pages on push to `main`:
- Uses demo mode with mock data
- No backend or API keys required
- Perfect for portfolio showcase

### Production

1. Deploy frontend to Vercel/Netlify
2. Set up Supabase project with migrations
3. Configure ElevenLabs, Twilio, and Stripe integrations
4. Set environment variables

## Project Structure

```
src/
├── components/     # UI components (shadcn/ui based)
├── contexts/       # React contexts (Auth, etc.)
├── hooks/          # Custom hooks for data fetching
├── lib/            # Utilities and demo mode
│   └── demo/       # Mock data for demo mode
├── pages/          # Route components
└── types/          # TypeScript definitions

supabase/
├── functions/      # Edge functions (40+)
└── migrations/     # Database schema
```

## Key Implementation Highlights

- **Multi-tenant Architecture**: RLS policies ensure complete data isolation between accounts
- **Real-time Updates**: React Query with automatic refetching
- **Type Safety**: Full TypeScript coverage with Supabase-generated types
- **Demo Mode**: Complete mock data layer for offline showcase
- **SPA Routing**: GitHub Pages compatible with 404 redirect handling

## License

Private project - for portfolio showcase only.

---

Built with React, TypeScript, Supabase, and ElevenLabs AI.
