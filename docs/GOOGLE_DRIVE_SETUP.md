# Google Drive backup setup (Shared Drive)

Service accounts **do not have storage quota** in their own "My Drive". To backup JSON files to Google Drive you must use a **Shared Drive** (Team Drive) and give the service account access to it.

---

## 1. Create a Shared Drive

1. Open **Google Drive**: [drive.google.com](https://drive.google.com).
2. In the left sidebar, click **Shared drives** (or "Shared with me" area → look for **Shared drives**).
3. Click **New** (or **+ New** → **Shared drive**).
4. Enter a name (e.g. **Master Dashboard Backups**), then click **Create**.

---

## 2. Create a folder inside the Shared Drive (optional)

1. Open your new Shared Drive.
2. Click **+ New** → **New folder**.
3. Name it (e.g. **Backups** or **JSON Backups**) and click **Create**.
4. Open that folder. You will use **this folder’s ID** in the app.

If you prefer to use the Shared Drive root, skip this step and use the Shared Drive’s own ID in step 5.

---

## 3. Get the folder ID

1. In Google Drive, open the **folder** you want to use (the one inside the Shared Drive, or the Shared Drive itself).
2. Look at the browser URL. It will look like:
   ```text
   https://drive.google.com/drive/folders/1ABC...xyz
   ```
3. Copy the part after `/folders/` — that is your **folder ID** (long string of letters and numbers).
4. Save it; you will set it as `GOOGLE_DRIVE_ROOT_FOLDER_ID` in the next steps.

---

## 4. Add the service account to the Shared Drive

1. In **Google Cloud Console**: [console.cloud.google.com](https://console.cloud.google.com) → your project.
2. Go to **IAM & Admin** → **Service accounts**.
3. Open your service account (or create one). Copy its **email** (e.g. `something@your-project.iam.gserviceaccount.com`).
4. In **Google Drive**, open your **Shared Drive** (not a folder inside it).
5. **Right‑click the Shared Drive name** (in the left sidebar or at the top) → **Share** (or click the person icon).
6. In “Add people and groups”, paste the **service account email**.
7. Set the role to **Content manager** (so it can create/update/delete files in that drive).
8. **Uncheck** “Notify people” (the service account doesn’t read email).
9. Click **Share** / **Send**.

The service account can now read and write inside this Shared Drive (and any folder inside it).

---

## 5. Set environment variables

In your app (e.g. `.env` or your host’s env):

1. **Root folder ID**
   - Variable: `GOOGLE_DRIVE_ROOT_FOLDER_ID`
   - Value: the **folder ID** you copied in step 3 (the folder inside the Shared Drive, or the Shared Drive’s ID if you use the root).

2. **Service account credentials** (one of these):
   - **Option A – File path**  
     `GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json`
   - **Option B – JSON string** (e.g. for Railway / hosted env)  
     `GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}`  
     Paste the **entire** contents of the service account JSON key file as one line.

3. **(Optional)** If you see “Method doesn't allow unregistered callers”:
   - In GCP: **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
   - Set `GOOGLE_DRIVE_API_KEY` or `GOOGLE_API_KEY` to that key.

Restart the app after changing env vars.

---

## 6. Verify

1. Open the app’s **Backup** page.
2. If setup is correct, you’ll see **Sync backup to Drive** and a link to **Open Drive folder**.
3. Run **Sync backup to Drive**. Files should appear under your Shared Drive folder (e.g. `Quotations/`, `Invoices/`, etc.).

---

## Quick checklist

- [ ] Shared Drive created in Google Drive  
- [ ] Folder (optional) created inside the Shared Drive  
- [ ] Folder ID copied from the URL  
- [ ] Service account email added to the Shared Drive as **Content manager**  
- [ ] `GOOGLE_DRIVE_ROOT_FOLDER_ID` set to that folder ID  
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` set  
- [ ] App restarted  
- [ ] Backup page shows sync button and “Open Drive folder”

If you use the **Shared Drive root** (no subfolder), use the Shared Drive’s URL when you open it in the browser and copy the ID from that URL the same way.
