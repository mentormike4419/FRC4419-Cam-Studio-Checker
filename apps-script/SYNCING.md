# Sync GitHub files into the existing Apps Script project

The production repository has a manual GitHub Action named **Sync Apps Script**. It copies the complete `apps-script/Code.gs` and `apps-script/CamReport.gs` files into the existing Google Apps Script project. Before copying them, it downloads that project's current files so other files and `appsscript.json` stay in place. It does not change the published web app deployment or its URL.

## One-time setup

Use the Google account that owns or can edit the existing Apps Script project.

1. In the Apps Script editor, open **Project Settings**, copy **Script ID** under **IDs**, and save it as the production repo's Actions secret `APPS_SCRIPT_ID`. The Script ID is not the web app `/exec` URL.
2. Turn on the **Apps Script API** at <https://script.google.com/home/usersettings>.
3. On your own computer, install Node.js and run `npm install -g @google/clasp`, then `clasp login`. Sign in to the same Google account. This creates `~/.clasprc.json` (on Windows, your home directory's `.clasprc.json`).
4. Copy the entire contents of that file into the production repo's Actions secret `CLASPRC_JSON`. Never put this file or its contents in a commit or chat.
5. Both secrets go in **Settings → Secrets and variables → Actions → New repository secret** in `FRC4419-Cam-Studio-Checker`.

## Each update

In the production repo, open **Actions → Sync Apps Script → Run workflow**. A green run means the editor's current project code was updated. Check that both `Code.gs` and `CamReport.gs` appear in the editor.

To make the already published `/exec` URL serve the new code, create a **new version of the existing deployment** in the Apps Script editor (**Deploy → Manage deployments → Edit → Version: New version → Deploy**). The GitHub Action intentionally leaves that deployment step manual while the report migration is being tested.

The two GitHub source files are the authoritative versions for future report edits. Do not paste patches into the Apps Script editor after setting up the sync.
