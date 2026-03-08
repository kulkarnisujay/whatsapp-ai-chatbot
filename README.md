<p align="center">
  <img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Groq-FF6B35?style=for-the-badge&logo=data:image/svg+xml;base64,&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
</p>

<h1 align="center">🤖 Aria — AI WhatsApp Marketing Chatbot</h1>

<p align="center">
  <strong>An autonomous AI-powered WhatsApp chatbot with a built-in CRM dashboard for lead generation, customer engagement, and automated follow-ups.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api-reference">API Reference</a>
</p>

---

## ✨ Features

### 🤖 AI Chatbot (Aria)
- **Conversational AI** powered by Llama 3.1 (8B) via Groq — blazing fast responses
- **Per-user conversation memory** with 30-minute session TTL
- **Smart lead capture** — proactively asks for email within 2-3 messages
- **Company knowledge base** — answers pricing, services, and policy questions accurately
- **Graceful fallbacks** — human-sounding responses when AI is unavailable

### 📊 CRM Dashboard
- **Real-time overview** — stat cards for Total, New, Engaged, and Converted leads
- **Live conversations** — split-view inbox with searchable lead list and chat history
- **Lead management** — change lead status (New → Engaged → Converted) with one click
- **Search & filter** — find leads by name, phone number, or pipeline status
- **Auto-refresh** — dashboard updates every 5 seconds, chat every 3 seconds
- **Premium dark mode** — glassmorphism UI with smooth animations

### ⏰ Automated Follow-Ups
- Hourly cron job scans for inactive leads (24+ hours no response)
- AI drafts personalized, context-aware follow-up messages
- Automatically sends via WhatsApp and logs to database

### 📧 Email Brochure Auto-Send
- **Auto-detects email addresses** in WhatsApp messages using regex
- Sends a **beautifully designed HTML brochure** with services, pricing packages, and a CTA
- Saves the email to the lead's database record
- Confirms delivery via WhatsApp: *"✉️ I've sent the details to your email!"*
- Uses Gmail SMTP (free, no external email service needed)

### 🔒 Security
- Webhook signature verification
- Environment-based API key management
- Rate limiting (stays within free tier quotas)
- Helmet.js security headers

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Node.js + TypeScript | Type safety & modern JS |
| **Framework** | Express 5 | Fast HTTP server |
| **AI Engine** | Groq (Llama 3.1 8B) | Free tier, lightning fast inference |
| **Database** | SQLite (better-sqlite3) | Zero-config, embedded, no external DB needed |
| **Frontend** | React + Vite | Fast dev server, optimized builds |
| **Messaging** | Meta WhatsApp Cloud API | Official WhatsApp Business integration |
| **Email** | Nodemailer + Gmail SMTP | Free email delivery, no third-party service |
| **Scheduling** | node-cron | Automated follow-up reminders |
| **Icons** | Lucide React | Beautiful, consistent iconography |

**Total monthly cost: $0.00** — All services used are on free tiers.

---

## 🏗️ Architecture

```
whatsapp-ai-chatbot/
├── src/
│   ├── app.ts                        # Express app, middleware, static serving
│   ├── server.ts                     # Entry point, starts server + cron
│   ├── config/
│   │   ├── env.ts                    # Environment validation
│   │   ├── ai.config.ts              # Groq API key, model, rate limits
│   │   ├── database.ts               # SQLite schema & initialization
│   │   └── whatsapp.config.ts        # Meta API configuration
│   ├── controllers/
│   │   ├── webhook.controller.ts     # Webhook verify + message handler
│   │   └── leads.controller.ts       # REST API for lead management
│   ├── routes/
│   │   ├── webhook.routes.ts         # POST/GET /api/webhook
│   │   └── leads.routes.ts           # CRUD /api/leads
│   ├── services/
│   │   ├── ai.service.ts             # Groq conversation engine + prompt
│   │   ├── whatsapp.service.ts       # Message routing & sending
│   │   ├── lead.service.ts           # Lead CRUD & conversation persistence
│   │   ├── email.service.ts          # Email brochure auto-sender
│   │   └── reminder.service.ts       # Automated follow-up cron engine
│   ├── types/
│   │   ├── whatsapp.types.ts         # Meta webhook payload types
│   │   └── database.types.ts         # SQLite schema types
│   └── utils/
│       └── logger.ts                 # Timestamped structured logging
├── dashboard/                        # React CRM Frontend
│   ├── src/
│   │   ├── App.tsx                   # Dashboard with stats, chat, search
│   │   ├── types.ts                  # Frontend TypeScript types
│   │   └── index.css                 # Dark mode design system
│   └── vite.config.ts                # Dev proxy to backend
├── data/                             # SQLite database (auto-created)
├── render.yaml                       # Render.com deployment config
├── .env.example                      # Environment template
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- A **Meta Developer Account** with a WhatsApp Business App
- A **Groq API Key** (free at [console.groq.com](https://console.groq.com))

### 1. Clone & Install

```bash
git clone https://github.com/kulkarnisujay/whatsapp-ai-chatbot.git
cd whatsapp-ai-chatbot
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```env
PORT=3000
NODE_ENV=development

# WhatsApp Cloud API (from Meta Developer Dashboard)
WHATSAPP_TOKEN=your_temporary_access_token
VERIFY_TOKEN=your_custom_webhook_verify_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# Groq AI (free at https://console.groq.com/keys)
GROQ_API_KEY=gsk_your_groq_api_key

# Email (Gmail SMTP — for auto-sending company brochures)
# Generate an App Password at: https://myaccount.google.com/apppasswords
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM_NAME=Aria | AI Assistant
```

### 3. Build & Run

```bash
# Build the dashboard
cd dashboard && npm run build && cd ..

# Build & start the server
npm run build
npm run start
```

The server will start on `http://localhost:3000`:
- **Dashboard**: http://localhost:3000
- **Health check**: http://localhost:3000/health
- **Webhook**: http://localhost:3000/api/webhook

### 4. Expose Locally (for development)

Use [ngrok](https://ngrok.com) to expose your local server:

```bash
ngrok http 3000
```

Copy the HTTPS URL and configure it in Meta Developer Dashboard → WhatsApp → Configuration → Callback URL as:
```
https://YOUR-NGROK-URL/api/webhook
```

---

## ☁️ Deployment

### Railway (Recommended — Free)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → "New Project" → "Deploy from GitHub Repo"
3. Select your repository
4. Add environment variables in the **Variables** tab
5. Go to Settings → Networking → "Generate Domain"
6. Update Meta webhook URL to: `https://YOUR-APP.up.railway.app/api/webhook`

### Render.com

A `render.yaml` Blueprint is included for one-click deployment:

1. Connect your GitHub repo on [render.com](https://render.com)
2. Render auto-detects the Blueprint
3. Fill in environment variables
4. Deploy!

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/webhook` | Meta webhook verification |
| `POST` | `/api/webhook` | Incoming WhatsApp messages |
| `GET` | `/api/leads` | List all leads (`?status=new` for filtering) |
| `GET` | `/api/leads/stats` | Lead counts by status |
| `GET` | `/api/leads/id/:id` | Get lead + conversation by ID |
| `PATCH` | `/api/leads/id/:id` | Update lead status or notes |
| `GET` | `/api/leads/:phone` | Get lead + conversation by phone |
| `GET` | `/health` | Server health check |

---

## 🧠 Customizing Aria

### Modify the Knowledge Base

Edit the `COMPANY KNOWLEDGE BASE` section in `src/services/ai.service.ts`:

```typescript
## COMPANY KNOWLEDGE BASE:
- We are a specialized software development agency...
- We offer 3 standard packages: Basic ($499), Pro ($999)...
- Our working hours are 9 AM to 5 PM EST...
```

### Change the AI Model

Edit `src/config/ai.config.ts`:

```typescript
model: 'llama-3.1-8b-instant',  // Change to any Groq-supported model
```

Available free models on Groq: `llama-3.1-8b-instant`, `llama-3.1-70b-versatile`, `mixtral-8x7b-32768`

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/kulkarnisujay">Sujay Kulkarni</a>
</p>
