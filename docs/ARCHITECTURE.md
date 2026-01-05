# Answer After - Architecture Documentation

## Overview

Answer After is an AI-powered call answering service platform that handles inbound calls using conversational AI agents. The system captures customer information, schedules appointments, and provides real-time analytics for service businesses.

## System Architecture

```
                                    ANSWER AFTER ARCHITECTURE

    +-----------------------------------------------------------------------------------+
    |                              FRONTEND (React + Vite)                              |
    |                                                                                   |
    |  +-------------+  +-------------+  +-------------+  +-------------+               |
    |  |  Dashboard  |  |    Calls    |  |   Leads     |  |  Settings   |               |
    |  |   Stats     |  |   History   |  |  Customers  |  |  Services   |               |
    |  +------+------+  +------+------+  +------+------+  +------+------+               |
    |         |                |                |                |                      |
    |         +----------------+----------------+----------------+                      |
    |                                   |                                               |
    |                          +--------v--------+                                      |
    |                          |  React Query    |                                      |
    |                          |  (Data Layer)   |                                      |
    |                          +--------+--------+                                      |
    +---------------------------|-------|--------------------------------------------- +
                                |       |
                    +-----------v-------v-----------+
                    |      SUPABASE PLATFORM        |
                    |                               |
                    |  +-------------------------+  |
                    |  |    Authentication       |  |
                    |  |    (JWT + Sessions)     |  |
                    |  +-------------------------+  |
                    |                               |
                    |  +-------------------------+  |
                    |  |    PostgreSQL DB        |  |
                    |  |    (RLS Protected)      |  |
                    |  |  - accounts             |  |
                    |  |  - users / roles        |  |
                    |  |  - calls / contacts     |  |
                    |  |  - appointments         |  |
                    |  |  - services             |  |
                    |  +-------------------------+  |
                    |                               |
                    |  +-------------------------+  |
                    |  |    Edge Functions       |  |
                    |  |    (Deno Runtime)       |  |
                    |  +------------+------------+  |
                    +---------------|---------------+
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
    +-----v-----+            +------v------+           +------v------+
    | ElevenLabs|            |   Twilio    |           |   Stripe    |
    |           |            |             |           |             |
    | - AI Agent|            | - Phone #s  |           | - Billing   |
    | - Voice   |            | - Voice     |           | - Subs      |
    | - Tools   |            | - SMS       |           | - Credits   |
    +-----------+            +-------------+           +-------------+
```

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework |
| TypeScript | Type Safety |
| Vite | Build Tool & Dev Server |
| TailwindCSS | Styling |
| shadcn/ui | Component Library |
| React Query | Server State Management |
| React Router | Client-side Routing |
| React Hook Form + Zod | Form Handling & Validation |
| Recharts | Data Visualization |
| Framer Motion | Animations |

### Backend
| Technology | Purpose |
|------------|---------|
| Supabase | Backend-as-a-Service |
| PostgreSQL | Database |
| Deno | Edge Functions Runtime |
| Row-Level Security | Multi-tenant Data Isolation |

### External Integrations
| Service | Purpose |
|---------|---------|
| ElevenLabs | Conversational AI Agents |
| Twilio | Phone Numbers, Voice, SMS |
| Stripe | Subscription Billing |

## Data Flow

### Inbound Call Flow

```
    +---------------+     +-----------------+     +------------------+
    |   Customer    |     |     Twilio      |     |  twilio-webhook  |
    |   Calls In    +---->+   Incoming      +---->+  Edge Function   |
    +---------------+     +-----------------+     +--------+---------+
                                                           |
                          +--------------------------------+
                          |
                          v
    +------------------+  |  +------------------+     +------------------+
    |   Create Call    |<-+  |  ElevenLabs AI   |     |   Agent Tools    |
    |   Record in DB   |     |  Agent Handles   +---->+  (save_contact,  |
    +------------------+     |  Conversation    |     |   log_intake)    |
                             +--------+---------+     +--------+---------+
                                      |                        |
                                      v                        v
                             +------------------+     +------------------+
                             |  Call Outcome    |     |  Contact/Intake  |
                             |  Determination   |     |  Saved to DB     |
                             +--------+---------+     +------------------+
                                      |
                                      v
                             +------------------+
                             |  Notifications   |
                             |  (SMS, Dashboard)|
                             +------------------+
```

### Authentication Flow

```
    User Login/Signup
           |
           v
    +------------------+
    |  Supabase Auth   |
    |  (JWT Tokens)    |
    +--------+---------+
             |
             v
    +------------------+
    |  Fetch User      |
    |  Profile + Role  |
    +--------+---------+
             |
             v
    +------------------+
    |  AuthContext     |
    |  Provides User   |
    +--------+---------+
             |
             v
    +------------------+
    |  RLS Policies    |
    |  Filter by       |
    |  account_id      |
    +------------------+
```

## Database Schema

### Core Entities

```
accounts
├── id (uuid, PK)
├── name
├── slug
├── timezone
├── business_hours_start/end
├── workflow_config (JSON)
└── widget_config (JSON)

users
├── id (uuid, PK)
├── email
├── full_name
├── account_id (FK -> accounts)
└── phone

roles
├── id (uuid, PK)
├── user_id (FK -> users)
└── role (owner | admin | staff)

calls
├── id (uuid, PK)
├── account_id (FK -> accounts)
├── contact_id (FK -> contacts)
├── twilio_call_sid
├── elevenlabs_conversation_id
├── caller_phone
├── status
├── outcome
├── duration_seconds
├── summary
└── started_at / ended_at

contacts
├── id (uuid, PK)
├── account_id (FK -> accounts)
├── phone
├── name
├── email
├── status (lead | customer)
├── interest_level (hot | warm | cold)
└── lead_status (new | contacted | converted | lost)

appointments
├── id (uuid, PK)
├── account_id (FK -> accounts)
├── call_id (FK -> calls)
├── service_id (FK -> services)
├── scheduled_start/end
├── status
└── service_price_cents

services
├── id (uuid, PK)
├── account_id (FK -> accounts)
├── name
├── price_cents
├── duration_minutes
└── is_active
```

### Relationships

```
accounts 1--* users
accounts 1--* calls
accounts 1--* contacts
accounts 1--* services
accounts 1--* appointments

users 1--1 roles
calls *--1 contacts
appointments *--1 services
appointments *--1 calls
```

## Edge Functions

| Function | Purpose |
|----------|---------|
| `twilio-webhook` | Receives inbound calls, triggers AI agent |
| `agent-save-contact` | Saves customer info during call |
| `agent-log-intake` | Logs service request details |
| `agent-lookup-contact` | Identifies returning customers |
| `get-elevenlabs-conversations` | Fetches conversation history |
| `stripe-webhook` | Processes subscription events |
| `purchase-phone-number` | Provisions Twilio numbers |
| `outbound-reminder-call` | Makes reminder calls |

## Security Model

### Multi-Tenancy
- All tables include `account_id` column
- Row-Level Security (RLS) policies enforce isolation
- Users can only access their own account's data

### Authentication
- Supabase Auth with JWT tokens
- Persistent sessions with auto-refresh
- Role-based access (owner, admin, staff)

### API Security
- Edge functions validate auth tokens
- Webhook endpoints verify signatures
- Secrets stored in environment variables

## Key Features

1. **AI Call Answering** - ElevenLabs agents handle inbound calls
2. **Lead Capture** - Automatically save caller information
3. **Appointment Scheduling** - Book services during calls
4. **Real-time Dashboard** - Analytics and call history
5. **Team Management** - Multi-user accounts with roles
6. **Outbound Campaigns** - Automated reminder calls
7. **Subscription Billing** - Stripe integration with credits

## Demo Mode

This repository includes a demo mode for portfolio showcasing:
- Set `VITE_DEMO_MODE=true` to enable
- Uses mock data instead of live Supabase
- Fully interactive UI with simulated responses
- No backend dependencies required

## Deployment

### Production
- Frontend: Vercel/Netlify (Vite static build)
- Backend: Supabase (managed PostgreSQL + Edge Functions)
- External: ElevenLabs, Twilio, Stripe accounts required

### Demo (GitHub Pages)
- Static build with mock data
- No backend required
- See deployment instructions in README
