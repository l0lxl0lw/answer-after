# Answer After - AI-Powered After-Hours Call Handling SaaS

## 🎯 Business Overview

Answer After is a SaaS platform that provides AI-powered after-hours call handling for service businesses making $2M-$10M annually. The system automatically answers calls, understands customer needs, and schedules services based on predefined business rules.

## 🏢 Target Market

- **Primary:** HVAC, plumbing, emergency service companies ($2M-$10M revenue)
- **Secondary:** Professional services (dental, chiropractic, medical) that close at 5 PM
- **Pain Point:** Missing revenue from after-hours emergency calls and scheduling

## 🔧 Core Features

### 1. AI Call Handling
- **Automatic Call Answering:** AI responds to all after-hours calls
- **Natural Conversation:** Understands customer intent and service requests
- **Emergency Detection:** Identifies urgent vs. routine service needs
- **Information Collection:** Gathers customer details, service type, preferred timing

### 2. Intelligent Scheduling
- **Rules-Based Booking:** Schedules based on owner-defined service rules
- **Availability Management:** Checks staff schedules and business hours
- **Price Calculation:** Automatically quotes based on service pricing rules
- **Conflict Resolution:** Handles double-bookings and availability conflicts

### 3. Business Rules Engine
Each service can have customizable rules defining:
- **Pricing:** Service cost and pricing tiers
- **Duration:** How long each service takes (e.g., 30 minutes for extraction)
- **Scheduling Rules:** When services can be booked
- **Emergency Protocols:** How to handle urgent requests
- **Staff Assignment:** Which staff can perform which services

### 4. Owner Notification System
- **Emergency Alerts:** Immediate SMS/email for emergency calls
- **Daily Summaries:** Overview of scheduled appointments
- **Rule Violations:** Notifications when AI can't handle requests
- **Call Transcripts:** Full conversation logs for quality control

## 📋 Functional Requirements

### User Authentication & Management
- **Multi-tenant Architecture:** Each business gets isolated data
- **User Roles:** Owner, Admin, Staff with different permissions
- **Self-service Onboarding:** Stripe-powered subscription signup
- **Business Profile Management:** Company details, hours, contact info

### Dashboard Features
- **Analytics Overview:** Call volume, conversion rates, revenue impact
- **Service Management:** CRUD operations for services and rules
- **Appointment Calendar:** View and manage scheduled services
- **Call History:** Transcripts, outcomes, customer feedback
- **Settings Management:** Business hours, notification preferences

### Service Configuration
- **Service Catalog:** Manage all offered services
- **Pricing Rules:** Set base prices and surge pricing
- **Scheduling Rules:** Define availability windows and constraints
- **Emergency Protocols:** Configure escalation procedures
- **Staff Scheduling:** Assign services to specific team members

### AI Integration Requirements
- **Voice Recognition:** Real-time speech-to-text conversion
- **Natural Language Processing:** Understand customer intent
- **Context Awareness:** Remember conversation history
- **Business Logic Integration:** Apply owner-defined rules
- **Escalation Triggers:** Know when to transfer to humans

## 🏗 Technical Architecture

### Repository Structure
```
answer-after/
├── answer-after-shared/     # Shared TypeScript types
├── answer-after-api/        # Express.js backend API
├── answer-after-web/        # Next.js frontend
└── answer-after-ai-service/ # Twilio + AI call handler
```

### Technology Stack

**Frontend (answer-after-web):**
- Next.js 14 with TypeScript
- Tailwind CSS for styling
- React Query for data management
- JWT-based authentication
- Responsive design for mobile/desktop

**Backend API (answer-after-api):**
- Express.js with TypeScript
- Prisma ORM with PostgreSQL
- JWT authentication & authorization
- Multi-tenant data isolation
- RESTful API design

**AI Service (answer-after-ai-service):**
- Express.js for Twilio webhooks
- Twilio for voice calls and SMS
- Pluggable AI provider integration
- Real-time conversation handling
- Call recording and transcription

**Shared Package (answer-after-shared):**
- TypeScript interfaces for all entities
- API response types
- Business logic types
- Reusable across all services

### Database Schema

**Core Entities:**
- **Business:** Company info, subscription status, settings
- **Users:** Authentication, roles, permissions
- **Services:** Service catalog with pricing and rules
- **ServiceRules:** Business logic for scheduling and pricing
- **Calls:** Call records, transcripts, outcomes
- **Appointments:** Scheduled services with customer details
- **Notifications:** SMS/email alerts and preferences

**Key Relationships:**
- Multi-tenant isolation by `businessId`
- Services have many rules
- Calls can create appointments
- Users belong to businesses with roles

## 🔄 User Workflows

### 1. Business Owner Onboarding
1. **Signup:** Create account with Stripe subscription
2. **Profile Setup:** Enter business details and hours
3. **Service Configuration:** Add services with pricing and rules
4. **Phone Integration:** Connect business phone to Twilio
5. **Testing:** Make test calls to verify AI responses

### 2. AI Call Handling Flow
1. **Call Received:** Customer calls after business hours
2. **AI Greeting:** Professional welcome message
3. **Intent Recognition:** Understand customer needs
4. **Information Gathering:** Collect service details and contact info
5. **Rule Application:** Check availability and pricing
6. **Booking Confirmation:** Schedule appointment or escalate
7. **Notifications:** Send confirmations and owner alerts

### 3. Daily Business Operations
1. **Morning Dashboard:** Review overnight calls and bookings
2. **Appointment Management:** Confirm, reschedule, or manage bookings
3. **Call Review:** Listen to transcripts for quality assurance
4. **Rule Adjustments:** Update services or scheduling rules
5. **Analytics Review:** Track conversion rates and revenue impact

## 📊 Business Rules Examples

### HVAC Emergency Service
```
Service: Emergency Heating Repair
Price: $150 base + $100/hour
Duration: 2-4 hours estimated
Rules:
  - Available: 24/7 for emergencies
  - Priority: Immediate (within 2 hours)
  - Escalation: If no technician available, call owner
  - Keywords: "no heat", "heating broken", "emergency"
```

### Dental Extraction
```
Service: Tooth Extraction  
Price: $300 flat rate
Duration: 30 minutes
Rules:
  - Available: Next business day only
  - Buffer: 15 minutes between appointments
  - Requirements: Require consultation first
  - Booking Window: 24 hours advance minimum
```

## 🔌 Integration Requirements

### Twilio Integration
- **Voice Calls:** Receive and handle incoming calls
- **SMS Messaging:** Send appointment confirmations
- **Call Recording:** Store conversations for quality/legal
- **Phone Numbers:** Support multiple business lines

### AI Provider Integration (Configurable)
- **OpenAI:** Fast responses, good conversational AI
- **Anthropic Claude:** Better reasoning, safety-focused
- **Google PaLM:** Cost-effective option
- **Streaming Responses:** Real-time conversation flow

### Calendar Integration (Future)
- **Google Calendar:** Sync appointments bidirectionally  
- **Outlook Calendar:** Enterprise calendar support
- **CalDAV Support:** Generic calendar protocol

### Payment Integration
- **Stripe Subscriptions:** Monthly/annual billing
- **Webhook Handling:** Payment success/failure events
- **Usage-based Billing:** Scale with call volume (future)

## 🚀 Success Metrics

### Technical KPIs
- **Call Answer Rate:** >99% of calls answered by AI
- **Response Latency:** <2 seconds AI response time
- **Booking Success Rate:** >70% of appropriate calls result in bookings
- **System Uptime:** >99.9% availability

### Business KPIs  
- **Revenue Recovery:** Track after-hours bookings value
- **Customer Satisfaction:** Post-call survey scores
- **Owner Time Savings:** Reduction in manual call handling
- **Conversion Rate:** Calls to paid appointments ratio

## 🔒 Security & Compliance

### Data Protection
- **Encryption:** All data encrypted in transit and at rest
- **Multi-tenancy:** Complete data isolation between businesses
- **Access Control:** Role-based permissions system
- **Audit Logging:** Track all data access and changes

### Compliance Requirements
- **HIPAA Consideration:** For medical/dental clients
- **Call Recording Laws:** Comply with state recording requirements
- **Data Retention:** Configurable retention policies
- **Privacy Controls:** Customer data deletion capabilities

## 🎯 Phase 1 MVP Scope

### Core Features (Implemented)
✅ User authentication and business signup
✅ Service management with basic rules
✅ Dashboard with analytics overview  
✅ AI service integration framework
✅ Call handling with Twilio webhooks
✅ Appointment scheduling system
✅ Multi-tenant architecture

### Next Development Priorities
1. **AI Provider Integration:** Implement OpenAI or Anthropic
2. **Enhanced Rules Engine:** Complex scheduling logic
3. **Notification System:** SMS/email alerts
4. **Call Recording:** Store and playback conversations  
5. **Mobile Optimization:** Responsive dashboard improvements

### Future Enhancements
- Advanced analytics and reporting
- Calendar integration (Google, Outlook)
- Multi-language support
- Advanced AI training on business-specific data
- Usage-based pricing tiers
- White-label solutions for larger clients

---

*This document captures the complete vision and requirements for the Answer After platform as implemented in the current codebase.*