<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=200&section=header&text=Random%20Chat&fontSize=70&fontColor=fff&animation=fadeIn&fontAlignY=35&desc=Real-Time%20Anonymous%20Chat%20Platform&descAlignY=55&descSize=16"/>

[![TypeScript](https://img.shields.io/badge/TypeScript-97.5%25-3178C6?style=for-the-badge&logo=typescript&logoColor=white)]()
[![CSS](https://img.shields.io/badge/CSS-1.8%25-1572B6?style=for-the-badge&logo=css3&logoColor=white)]()
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)]()
[![Live Demo](https://img.shields.io/badge/Live_Demo-00C853?style=for-the-badge)](https://random-chat-wheat.vercel.app)

**Chat Anonymously. Connect Globally.**

</div>

---

## 🎯 Overview

Random Chat is a modern **real-time anonymous chat application** built with Next.js 15 and TypeScript. Features instant messaging, user presence indicators, and a sleek dark-themed UI.

---

## ✨ Features

- 💬 **Real-time Messaging** - Instant message delivery via WebSocket
- 👤 **Anonymous Chat** - No registration required
- 🟢 **Presence Indicators** - See who's online
- 🌙 **Dark Theme** - Easy on the eyes
- 📱 **Responsive Design** - Works on all devices
- 🔒 **End-to-End Encryption** - Secure conversations

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/webspoilt/Random_Chat.git
cd Random_Chat

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Configure your database URL

# Initialize database
npx prisma migrate dev

# Start development server
npm run dev
```

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript 5** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **Prisma** | Database ORM |
| **WebSocket** | Real-time communication |
| **PostgreSQL** | Database |

---

## 📁 Project Structure

```
Random_Chat/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   ├── lib/             # Utilities
│   └── hooks/           # Custom hooks
├── db/                   # Database migrations
├── prisma/              # Prisma schema
├── public/              # Static assets
└── mini-services/       # Chat microservice
```

---

## 🌐 Live Demo

**Try it now:** [random-chat-wheat.vercel.app](https://random-chat-wheat.vercel.app)

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

MIT License

---

<div align="center">

**Start Chatting! 💬**

**Built by [webspoilt](https://github.com/webspoilt)**

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:f093fb,50:764ba2,100:667eea&height=100&section=footer"/>

</div>
