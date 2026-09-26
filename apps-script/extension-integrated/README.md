# Integrated Chrome extension (v0.3.3)

This is the source used for the FRC4419 CAM Studio Checker Chrome Web Store package. It opens a side panel beside the active Onshape CAM Studio, reads its document, workspace, and element IDs from the tab URL, and asks the [Apps Script backend](../Code.gs) for a read-only CAM settings report.

The report displays jobs, machine Output unit, setups, tools, and operations. Lengths use **Inch (MM)** and feeds use **Inch/min (MM/min)**. The Machine section checks Output unit only: Metric is marked as ready, Imperial is flagged to fix, and missing values are marked for review. It does not change CAM settings, inspect generated G-code, infer material, or apply spreadsheet rules.

## Use

1. Open an Onshape CAM Studio workspace tab.
2. Click the extension icon to open the side panel.
3. Click **Connect** and authorize Onshape in the new tab. Close the authorization tab after it says the connection succeeded.
4. Click **Status**, then **Show CAM settings**. No URL needs to be pasted.
5. Click **Forget grant** to remove this browser's stored connection from the backend.

## Run from source

1. Save all six files in this directory together. The `manifest.json` must be at its root.
2. In Chrome, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and select this directory.
3. The packaged `background.js` points to the team's Google Apps Script web app. To use your own backend, deploy [Code.gs](../Code.gs) as a web app, set the `ONSHAPE_CLIENT_ID` and `ONSHAPE_CLIENT_SECRET` Script Properties, configure your Onshape OAuth redirect URI, and change `BACKEND_URL` in `background.js` to your own `/exec` URL.
4. After changing the Apps Script backend, deploy a new version of the existing web app. After changing extension source, reload the unpacked extension.

The extension source contains no Onshape client secret. Its OAuth grant is maintained by the deployed Apps Script backend.