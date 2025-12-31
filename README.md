# YouTube Automation System

A fully automated, policy-compliant YouTube content pipeline built with Node.js.

## Features
- **Trend Discovery**: Mocked trend fetching (extensible to Google Trends).
- **Topic Scoring**: Smart scoring based on search volume, competition, and RPM.
- **Content Generation**:
  - Script generation via OpenAI (or templates).
  - Voiceover via OpenAI TTS.
  - Video rendering via FFmpeg (stitches voice + background).
  - Thumbnail generation via Jimp.
- **YouTube Integration**: Auto-upload with SEO metadata.
- **Optimization**: Feedback loop based on analytics.

## Prerequisites
- Node.js (v18+)
- FFmpeg installed on system
- API Keys:
  - OpenAI API Key
  - Google/YouTube Data API Credentials

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Copy `.env.example` to `.env` and fill in your keys.
   ```bash
   cp .env.example .env
   ```

3. **Assets**
   Place a background video loop in `assets/stock/background.mp4` (optional). If missing, a black background is used.

## Usage

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

## Project Structure
- `src/main.ts`: Entry point.
- `src/modules/`: Functional modules (trends, script, video, etc.).
- `src/config/`: Configuration files.
- `src/state/`: SQLite database.

## License
MIT
