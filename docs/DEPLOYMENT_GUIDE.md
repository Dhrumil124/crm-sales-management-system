# Cloud Deployment Guide: Vercel (Frontend) & Render (Backend)

This guide provides simple, step-by-step instructions to deploy your CRM Sales Management project online with **zero lag**, **free hosting**, and **reliable persistence** for academic presentations.

---

## Architecture Overview

* **Frontend:** Deployed to **Vercel** (Global Edge CDN, automatic HTTPS, sub-100ms load times).
* **Backend:** Deployed to **Render** (Node.js Web Service with dynamic port and HTTP compression).
* **Database:** SQLite with Write-Ahead Logging (`WAL` mode).
* **Keep-Alive:** **UptimeRobot** pinging the `/health` endpoint every 5 minutes to prevent Render free tier cold-start lag.

---

## Step 1: Deploy Backend to Render

1. Go to [render.com](https://render.com) and sign in (using GitHub).
2. Click **New +** > **Web Service**.
3. Connect your CRM GitHub repository.
4. Fill in the service configuration:
   * **Name:** `crm-backend` (or your preferred name)
   * **Region:** Choose the region closest to you (e.g., *Singapore*, *Frankfurt*, *Ohio*)
   * **Root Directory:** `backend`
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Instance Type:** `Free`
5. In **Environment Variables**, add:
   * `JWT_SECRET` = `any_secure_random_string_key_here`
   * `NODE_ENV` = `production`
   * `CLIENT_URL` = (Leave blank initially, or add your Vercel URL once created, e.g. `https://your-crm.vercel.app`)
6. *(Optional - Persistent Data)*: If you want database records and uploaded attachments to permanently persist across redeploys on Render:
   * Under the **Disks** section in Render, click **Add Disk**.
   * Mount path: `/var/data`
   * Size: `1 GB`
   * In Environment Variables, set:
     - `DB_PATH` = `/var/data/crm.sqlite`
     - `STORAGE_DIR` = `/var/data`
7. Click **Create Web Service**.
8. Once deployed, copy your backend URL:  
   👉 `https://crm-backend-xxxx.onrender.com`

---

## Step 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** > **Project**.
3. Import your CRM GitHub repository.
4. Configure the project:
   * **Framework Preset:** `Vite` (automatically detected)
   * **Root Directory:** Click **Edit** and choose `frontend`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
5. Expand **Environment Variables** and add:
   * **Key:** `VITE_API_URL`
   * **Value:** `https://your-backend-url.onrender.com/api`  *(replace with your actual Render URL from Step 1, ending with `/api`)*
6. Click **Deploy**.
7. Vercel will build and deploy your site in ~30 seconds.
8. Copy your live frontend URL:  
   👉 `https://crm-sales-management.vercel.app`

---

## Step 3: Link CORS in Render Backend

1. Go back to your Render Dashboard -> Your Web Service -> **Environment**.
2. Set or update `CLIENT_URL`:
   * `CLIENT_URL` = `https://crm-sales-management.vercel.app`
3. Click **Save Changes** (Render will automatically apply it).

---

## Step 4: Eliminate Cold-Start Lag (Crucial for Presentations!)

> [!TIP]
> Render's free tier spins down if there are no requests for 15 minutes. The next visitor experiences a 50-80 second delay while the server wakes up.
> Use a free ping service so your site responds **instantly** during evaluator tests:

1. Go to [uptimerobot.com](https://uptimerobot.com) (100% free).
2. Click **Add New Monitor**.
   * **Monitor Type:** `HTTP(s)`
   * **Friendly Name:** `CRM Backend Keep-Alive`
   * **URL (or IP):** `https://your-backend-url.onrender.com/health`
   * **Monitoring Interval:** `5 minutes`
3. Click **Create Monitor**.

Now, UptimeRobot will ping your `/health` endpoint every 5 minutes. The Render backend will **stay warm 24/7**, eliminating all cold-start lag!

---

## Local Development (Unchanged)

Your local development workflow remains 100% intact:
* **Backend:** `cd backend && npm run dev` (runs on `http://localhost:5000`)
* **Frontend:** `cd frontend && npm run dev` (runs on `http://localhost:5173`)
If `VITE_API_URL` is not set locally, the frontend automatically falls back to `http://localhost:5000/api`.
