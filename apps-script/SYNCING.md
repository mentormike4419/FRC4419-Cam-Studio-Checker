# Sync GitHub files into the existing Apps Script project

The production repository has a manual GitHub Action named **Sync Apps Script**. It copies `apps-script/Code.gs`, `apps-script/CamReport.gs`, and `apps-script/CallbackIcon.gs` into the existing Google Apps Script project. Before copying them, it downloads that project's current files so other files and `appsscript.json` stay in place. It checks the report version against the next Apps Script deployment version before updating the existing web app deployment, while keeping its URL. The deployment ID comes from the extension's configured web app URL and is checked against the connected Apps Script project.

## One-time setup

Use the Google account that owns or can edit the existing Apps Script project.

1. In the Apps Script editor, open **Project Settings**, copy **Script ID** under **IDs**, and save it as the production repo's Actions secret `APPS_SCRIPT_ID`. The Script ID is not the web app `/exec` URL.
2. Turn on the **Apps Script API** at <https://script.google.com/home/usersettings>.
3. On your own computer, install Node.js and run `npm install -g @google/clasp`, then `clasp login`. Sign in to the same Google account. This creates `~/.clasprc.json` (on Windows, your home directory's `.clasprc.json`).
4. Copy the entire contents of that file into the production repo's Actions secret `CLASPRC_JSON`. Never put this file or its contents in a commit or chat.
5. Both secrets go in **Settings → Secrets and variables → Actions → New repository secret** in `FRC4419-Cam-Studio-Checker`.

## Each update

Changes to `apps-script/Code.gs`, `apps-script/CamReport.gs`, or `apps-script/CallbackIcon.gs` on production `main` automatically start **Actions → Sync Apps Script**. You can also select **Run workflow** from that Actions page to publish the current GitHub source without changing a file. A green run means the project files were updated and a new version was published to the existing `/exec` URL. Check that `Code.gs`, `CamReport.gs`, and `CallbackIcon.gs` appear in the editor, then test the extension's report against an open CAM Studio.

The two GitHub source files are the authoritative versions for future report edits. Do not paste patches into the Apps Script editor after setting up the sync.
