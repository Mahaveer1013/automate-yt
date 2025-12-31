# YouTube Automation System – Installation Guide

This document provides step-by-step instructions to install, configure, and deploy the YouTube Automation System in development and production environments.

---

## 1. Prerequisites

### 1.1 System Requirements

* Node.js **18+** (ESM support required)
* FFmpeg installed and available in `PATH`
* SQLite **or** PostgreSQL
* Minimum **4 GB RAM** (8 GB recommended)
* Minimum **10 GB free disk space**
* Linux / macOS / Windows (Linux recommended for production)

---

## 2. FFmpeg Installation

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y ffmpeg
```

Verify:

```bash
ffmpeg -version
```

### macOS

```bash
brew install ffmpeg
```

### Windows

1. Download from: [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Extract the binaries
3. Add the `bin` directory to **System PATH**

Verify:

```bash
ffmpeg -version
```

---

## 3. Project Setup

### 3.1 Clone or Extract the Project

```bash
mkdir youtube-automation
cd youtube-automation
```

### 3.2 Install Dependencies

```bash
npm install
```

---

## 4. Environment Configuration

### 4.1 Create Environment File

```bash
cp .env.template .env
```

### 4.2 Required Environment Variables

Edit `.env` and configure the following:

```env
NODE_ENV=development

YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=

DATABASE_URL=sqlite://./data/automation.db

ASSETS_PATH=./src/assets
OUTPUT_PATH=./output
LOG_DIR=./logs
```

> For PostgreSQL, use:

```env
DATABASE_URL=postgresql://user:password@host:5432/youtube_automation
```

---

## 5. Build the Project

```bash
npm run build
```

This generates compiled output in the `dist/` directory.

---

## 6. YouTube API Setup

### 6.1 Google Cloud Configuration

1. Go to **Google Cloud Console**
2. Create or select a project
3. Enable the following APIs:

   * YouTube Data API v3
   * YouTube Analytics API
4. Create **OAuth 2.0 Credentials**

   * Application type: **Desktop App**
5. Add your Google account as a **Test User**

Copy the **Client ID** and **Client Secret** into `.env`.

---

## 7. Initial OAuth Refresh Token Generation

You must run the OAuth flow once to obtain a refresh token.

### 7.1 Create Token Script

Create `get-refresh-token.js`:

```js
import { google } from 'googleapis';
import readline from 'readline';

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'http://localhost:3000/oauth2callback'
);

const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes
});

console.log('Open this URL in your browser:\n', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Paste the authorization code here: ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log('REFRESH TOKEN:', tokens.refresh_token);
  rl.close();
});
```

### 7.2 Run the Script

```bash
node get-refresh-token.js
```

Copy the refresh token into `.env`:

```env
YOUTUBE_REFRESH_TOKEN=...
```

---

## 8. Running the System

### 8.1 Start the Automation Pipeline

```bash
npm start
```

### 8.2 Development Mode (Auto Reload)

```bash
npm run dev
```

---

## 9. Scheduling

### 9.1 Using System Cron

```bash
crontab -e
```

Example (run daily at 9 AM):

```cron
0 9 * * * cd /path/to/youtube-automation && npm start
```

### 9.2 Built-in Scheduler

Configure scheduling in:

```ts
channel.config.ts
```

Enable:

```ts
uploadSchedule: {
  enabled: true,
  days: ['mon', 'wed', 'fri'],
  time: '19:00'
}
```

---

## 10. Monitoring & Logs

### View Logs

```bash
tail -f logs/combined.log
```

### View Database (SQLite)

```bash
sqlite3 data/automation.db
```

---

## 11. Troubleshooting

### FFmpeg Not Found

```bash
ffmpeg -version
```

Ensure FFmpeg is installed and in `PATH`.

---

### YouTube API Quota Exceeded

* Check quotas in Google Cloud Console
* Reduce run frequency
* Request quota increase if needed

---

### OAuth Errors

* Refresh token expired or revoked
* Re-run OAuth flow
* Update `.env`

---

### Disk Space Issues

```bash
rm -rf output/*
```

Adjust retention policies in code.

---

## 12. Production Deployment (Docker)

### 12.1 Dockerfile

```dockerfile
FROM node:18-alpine

RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY src/assets ./src/assets

RUN mkdir -p logs output data

ENV NODE_ENV=production
ENV ASSETS_PATH=/app/src/assets
ENV OUTPUT_PATH=/app/output
ENV LOG_DIR=/app/logs

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

CMD ["node", "dist/main.js"]
```

---

### 12.2 docker-compose.yml

```yaml
version: '3.8'

services:
  youtube-automation:
    build: .
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/youtube_automation
    volumes:
      - ./data:/app/data
      - ./output:/app/output
      - ./logs:/app/logs
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: youtube_automation
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 13. Compliance & Safety

* Original content only
* No copyright infringement
* No fake engagement or bots
* API rate limits respected
* Topic filtering enabled
* Full logging and error handling

---

## 14. Summary

This installation sets up a **production-grade, policy-compliant YouTube automation system** with:

* End-to-end automation
* Modular Node.js architecture
* Safe YouTube API usage
* Docker-based deployment
* Monitoring, logging, and analytics

The system is designed for **long-term, sustainable automation**, not shortcuts.
