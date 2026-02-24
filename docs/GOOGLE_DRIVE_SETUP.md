# Google Drive PDF backup – setup guide

This guide walks you through setting the **root folder** and **Google credential** so the app can upload PDFs to Google Drive from the Backup page.

---

## 1. Create a Google Cloud project and enable Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick an existing one):
   - Top bar: click the project name → **New Project** → e.g. "Master Dashboard" → **Create**.
3. Enable the Drive API:
   - Left menu: **APIs & Services** → **Library**.
   - Search for **Google Drive API** → open it → **Enable**.

---

## 2. Create a service account and download the JSON key

1. In Cloud Console: **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **Service account**.
3. **Service account name**: e.g. `dashboard-pdf-sync` → **Create and Continue**.
4. **Grant access** (optional): skip → **Done**.
5. In the list, click the new service account.
6. Open the **Keys** tab → **Add Key** → **Create new key** → **JSON** → **Create**.  
   A JSON file will download. **Keep it secret** (do not commit to git).
7. Note the **service account email** (e.g. `dashboard-pdf-sync@your-project.iam.gserviceaccount.com`). You’ll use it in the next step.

---

## 3. Create the root folder in Google Drive and share it

1. Open [Google Drive](https://drive.google.com/) in your browser (use the same Google account you use for the project, or any account that will “own” the folder).
2. Create a new folder, e.g. **Master Dashboard PDFs**.
3. **Right‑click the folder** → **Share**.
4. In “Add people and groups”, paste the **service account email** from step 2.
5. Give it **Editor** access → uncheck “Notify people” if you prefer → **Share**.
6. **Get the folder ID:**
   - Open the folder (double‑click it).
   - Look at the URL in the address bar. It will look like:
     ```text
     https://drive.google.com/drive/folders/1ABC...xyz
     ```
   - The part after `/folders/` is the **folder ID**. Copy it (e.g. `1ABC...xyz`).

---

## 4. Set environment variables

Add these to your `.env` (or to your host’s env, e.g. Railway).

### 4a. Root folder ID

```env
GOOGLE_DRIVE_ROOT_FOLDER_ID="1ABC...xyz"
```

Replace `1ABC...xyz` with the folder ID you copied in step 3.

### 4b. Credential (choose one option)

**Option A – JSON file (good for local / your own server)**

1. Put the downloaded JSON file somewhere safe, e.g. `./secrets/google-service-account.json`.
2. Add to `.env`:

```env
GOOGLE_APPLICATION_CREDENTIALS="./secrets/google-service-account.json"
```

3. Add `secrets/` (or the path you use) to `.gitignore` so the key is never committed.

**Option B – JSON as a string (good for Railway / hosted env)**

1. Open the downloaded JSON file in a text editor.
2. Copy the **entire** contents (one line is fine).
3. In your host’s env (e.g. Railway **Variables**), add:
   - **Name:** `GOOGLE_SERVICE_ACCOUNT_JSON`
   - **Value:** paste the full JSON string.  
     If the value must be one line, ensure there are no line breaks in the middle of the string.

Example (conceptually; your real value will be much longer):

```env
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'
```

---

## 5. Restart and test

1. Restart your app (so it reads the new env vars).
2. Open the app → **Backup** page.
3. You should see:
   - **Open Drive folder** (opens your root folder in a new tab).
   - **Sync PDFs to Drive now** (runs the upload).
4. Click **Sync PDFs to Drive now**. When it finishes, check the root folder in Drive; you should see `Quotations/`, `Invoices/`, and optionally `Paragon/` and `Erha/` with PDFs inside.

---

## Summary

| What you need | Env variable | Where to get it |
|---------------|--------------|------------------|
| Root folder   | `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Create folder in Drive → open it → copy ID from URL (`.../folders/ID`) |
| Credential    | `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud Console → Service account → Keys → Create JSON key; then paste JSON or path to file |

**Important:** The Drive folder must be **shared with the service account email** (Editor), or the app cannot upload files.
