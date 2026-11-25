# StreamBox — Apple HIG Bento YouTube MP4 & MP3 Downloader

A responsive full-stack web application for downloading YouTube videos as **MP4** or **MP3**, designed around Apple Human Interface Guidelines (HIG) and an asymmetric Bento Box Grid.

---

## Folder Structure

```text
yt-bento-downloader/
├── Dockerfile                  # Production image (Node + yt-dlp + ffmpeg + React dist)
├── .dockerignore
├── render.yaml                 # One-click Docker deploy blueprint for Render
├── README.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── app.js              # Express app, CORS, API routes, production static serving
│   │   ├── server.js           # HTTP server entrypoint
│   │   ├── routes/
│   │   │   └── api.js          # /health, /info, /downloads, SSE /events, /file
│   │   ├── services/
│   │   │   └── ytdlp.js        # yt-dlp & ffmpeg process orchestration and job cleanup
│   │   └── utils/
│   │       └── youtube.js      # URL validation, stream parsing, error mapping, progress parser
│   └── tests/
│       └── youtube.test.js     # Unit tests (node --test)
└── frontend/
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── vite.config.js          # Vite + Tailwind v4 + /api dev proxy
    └── src/
        ├── App.jsx
        ├── index.css           # Apple HIG vibrancy, hairline borders, theme tokens
        ├── main.jsx
        ├── components/
        │   ├── ActionStatusTile.jsx
        │   ├── BentoTile.jsx
        │   ├── FormatQualityTile.jsx
        │   ├── HeroInputTile.jsx
        │   ├── MediaPreviewTile.jsx
        │   ├── RecentHistoryTile.jsx
        │   └── ToastContainer.jsx
        ├── services/
        │   └── api.js          # REST + EventSource SSE client
        └── utils/
            └── youtube.js      # Client URL validation & formatters
```

---

## 1. Prerequisites (`yt-dlp` and `ffmpeg`)

The backend spawns `yt-dlp` and `ffmpeg` locally to inspect streams, download media, merge 1080p/4K MP4 video+audio, and encode MP3 bitrates.

### Windows
```powershell
# Using winget (recommended)
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg

# Or using Chocolatey
choco install yt-dlp ffmpeg
```
Restart your terminal after installing so `yt-dlp` and `ffmpeg` are on your `PATH`, then verify:
```powershell
yt-dlp --version
ffmpeg -version
```

### macOS
```bash
brew install yt-dlp ffmpeg
```

### Linux (Ubuntu / Debian)
```bash
sudo apt update && sudo apt install -y ffmpeg python3-pip
pip3 install -U yt-dlp
```

*(Optional)* If `yt-dlp` or `ffmpeg` are installed outside your system `PATH`, set `YT_DLP_PATH` and `FFMPEG_PATH` in `backend/.env`.

---

## 2. Running Locally (Development)

### Step 1: Start the Backend (`http://localhost:3001`)
```bash
cd backend
cp .env.example .env   # On Windows PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

### Step 2: Start the Frontend (`http://localhost:5173`)
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. Vite proxies `/api/*` requests directly to `http://localhost:3001`.

### Running Backend Tests
```bash
cd backend
npm test
```

---

## 3. Publishing as a Website

Because `yt-dlp` and `ffmpeg` are native CLI binaries, this app cannot run on static-only serverless hosts alone — it needs a container or VM host that includes `yt-dlp` and `ffmpeg`. The included **`Dockerfile`** packages Node.js, `yt-dlp`, `ffmpeg`, and the built React app into a single production server.

### Option A: Deploy to Render (Free / Easy via `render.yaml`)
1. Push this project folder to a GitHub repository.
2. Go to [render.com](https://render.com) → **New +** → **Blueprint** (or **Web Service** → select your repo).
3. Render automatically detects `render.yaml` and `Dockerfile`, builds the image, and publishes your live HTTPS URL.

### Option B: Deploy to Railway or Fly.io
- **Railway:** Create a new project from your GitHub repo. Railway auto-detects the root `Dockerfile` and exposes port `3001` (or the injected `PORT` env var).
- **Fly.io:** Run `fly launch` in the root directory; Fly builds directly from `Dockerfile` and deploys globally.

### Option C: Split Hosting (Frontend on Vercel/Netlify + Backend on Render/Railway)
1. Deploy `backend/` using the `Dockerfile` (or a Node+Python+FFmpeg service) and note its URL (e.g. `https://api.example.com`).
2. Set `CORS_ORIGIN=https://your-frontend.vercel.app` on the backend.
3. Deploy `frontend/` to Vercel or Netlify with build command `npm run build`, output directory `dist`, and environment variable:
   ```env
   VITE_API_BASE_URL=https://api.example.com/api
   ```

### Test the Production Container Locally
```bash
docker build -t streambox-yt .
docker run -p 3001:3001 streambox-yt
```
Then visit **http://localhost:3001**.
