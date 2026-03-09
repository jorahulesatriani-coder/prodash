# ⚡ PRODASH — Personal Productivity Dashboard

A live, AI-powered productivity dashboard for managing 6 brands with full task tracking, analytics, reminders, and an AI assistant.

## 🚀 Deploying to GitHub Pages (Step-by-Step)

### Step 1 — Upload to GitHub
1. Go to **github.com** → click **"New repository"**
2. Name it `prodash` (or anything you like)
3. Set to **Public** (required for free GitHub Pages)
4. Click **"Create repository"**

### Step 2 — Upload the files
**Option A — GitHub Web Upload (easiest):**
1. On your new repo page, click **"uploading an existing file"**
2. Drag and drop ALL the files from this folder (maintain the folder structure)
3. Click **"Commit changes"**

**Option B — Git command line:**
```bash
cd prodash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/prodash.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages** (left sidebar)
2. Under **"Build and deployment"**, set Source to **"GitHub Actions"**
3. Click **Save**

### Step 4 — Wait for deployment
- Go to the **Actions** tab in your repo
- You'll see the build running (takes ~2 minutes)
- Once done, your site is live at: `https://YOUR_USERNAME.github.io/prodash/`

---

## 💾 Data Storage
All your data is stored in your **browser's localStorage** — it persists between sessions automatically. To back up or move your data, use the **"Export Backup"** button in the sidebar.

## ✨ Features
- 📋 **Task Management** — 6 brands × 3 tabs (Reporting, Compliance, Accounting)
- 📊 **Analytics** — Weekly/monthly charts, brand breakdown table
- 📅 **Calendar** — Monthly view with reminders
- 📌 **Pin Board** — Colour-coded sticky notes
- 🤖 **AI Assistant** — Real-time productivity insights
- 📸 **File Uploads** — Screenshots per brand
- 🔔 **Reminders** — With brand tags and date/time
- ⬇ **Data Export/Import** — JSON backup system
- 📱 **Fully Responsive** — Works on mobile and desktop

