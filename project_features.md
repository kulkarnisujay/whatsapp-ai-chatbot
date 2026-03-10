# 🤖 Aria CRM — WhatsApp AI Marketing Assistant

Aria CRM is a robust, production-ready WhatsApp bot designed for lead generation, customer engagement, and automated marketing workflows. Powered by the Meta Cloud API and Groq's high-speed LLMs, it provides a seamless conversational experience while capturing essential lead data.

---

## 🌟 Core Functional Features

### 1. 🧠 Intelligent Conversational AI (Powered by LLaMA 3.1)
- **Natural Language Understanding:** Parses user intent accurately, regardless of typos or slang.
- **Contextual Memory:** Remembers the past 15 messages (with sliding window truncation) within a 4-hour session to maintain relevant conversation flow without exceeding token limits.
- **Strict Persona Formatting:** Enforces concise, bulleted, and emoji-enhanced responses (max 3 sentences) to prevent overwhelming the user with "walls of text."
- **Conversational Reset:** Automatically wipes memory and restarts the conversation context whenever a user sends a greeting (e.g., "Hi", "Hello", "Menu") to prevent getting stuck in old loops.

### 2. 👋 Automated Onboarding & Welcome Sequence
- **Forced First-Touch Greeting:** Guaranteed to send an interactive Welcome Menu to any brand-new user, overriding initial LLM interpretation.
- **Interactive Menus (Buttons & Lists):** Utilizes WhatsApp's native UI elements for smooth navigation through Services, Pricing drops, and Call Bookings.

### 3. 🎯 Lead Capture & Scoring System
- **Automatic CRM Registration:** Instantly creates a new lead entry in the SQLite database upon the first incoming message.
- **Dynamic Lead Scoring:** Assigns varying point values based on real-time behavior:
  - Sent first message (+10 pts)
  - Requested Pricing (+15 pts)
  - Requested to Book a Call (+20 pts)
  - Provided Email Address (+25 pts)
- **Lead Status Pipeline:** Automatically upgrades leads through an invisible funnel: `New` -> `Engaged` -> `Qualified`.

### 4. 📧 Email Extraction & Automated Brochures
- **Regex-Powered Detection:** Actively scans incoming text messages for email patterns.
- **Automated Delivery:** Instantly fires off a beautifully formatted HTML company brochure using Nodemailer (via Zoho/SMTP) when an email is detected.
- **Deduplication:** Ensures brochures are only sent once per lead, even if they share their email multiple times.

### 5. ⏰ Smart Follow-up Reminders
- **Background Cron Job:** A standalone scheduler (running every hour) checks the database for leads that haven't responded.
- **Delayed Engagement:** Automatically sends a gentle "checking in" message to users who stopped replying exactly 24 hours ago.

---

## 🎨 Frontend Dashboard UI

- **Premium Dark Mode Engine:** Built with React/Vite using a sophisticated "Outfit" font family and custom glassmorphism styling.
- **Live Metric Tracking:** Displays real-time statistics for Total Leads, Hot Leads, New, Engaged, and Converted numbers.
- **Interactive Visual Funnel:** Contains a dynamic pipeline visualizing the health of the current marketing database.

---

## 🛡️ Technical & Security Posture

### 1. 🔒 Cryptographic Webhook Security
- Implements strict `HMAC-SHA256` payload verification using the Meta `App Secret`.
- Instantly drops any forged requests that don't originate directly from Meta's edge servers.

### 2. 🛡️ DDoS Protection (Rate Limiting)
- Protects the webhook endpoint using `express-rate-limit`, permitting a maximum of 200 requests per minute per IP to prevent abusive polling or server flooding.

### 3. 🔁 Graceful API Recovery (Axios Retry)
- Uses exponential backoff (via `axios-retry`) for outbound Meta API requests.
- Automatically and silently retries sending messages up to 3 times if Meta's Graph API experiences a 5xx timeout or rate-limiter response.

### 4. 🚀 Zero-Downtime Deployment
- Fully pre-configured for platforms like Railway and Vercel.
- Integrated `npm run build` scripts pre-compile the React frontend into static assets served directly through the heavily optimized Express backend via `helmet`.

---

## ⚙️ Technology Stack

- **Backend Logic:** Node.js, Express.js (v5), TypeScript
- **Frontend Dashboard:** React, Vite, Vanilla CSS
- **Database Engine:** `better-sqlite3` (Embedded, Zero-Latency, WAL-mode enabled)
- **LLM Engine:** Groq SDK (LLaMA 3.1 8b Instant)
- **Email Infrastructure:** Nodemailer
- **Communication Pipeline:** Meta Developer Graph API (Whatsapp Cloud API v21.0)
- **Testing environment:** ngrok (for local webhook tunneling)
