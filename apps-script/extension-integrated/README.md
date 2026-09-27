# Chrome extension (production v0.3.19)

FRC4419 CAM Studio Checker opens a side panel beside an Onshape CAM Studio. It reads the active tab URL and sends the document, workspace, and element IDs to the Apps Script backend. The backend reads the CAM data and builds the report; the extension displays the returned text. The Onshape connection requests read-only access.

The report includes selected Job body names and Stock Direction Type, machine Output unit, setup origin and orientation, tools, and supported operations. It shows lengths as **Inch (MM)** and feeds as **Inch/min (MM/min)**. Built-in indicators call out the Metric output unit, the drill spindle speed range, the 24,000 mill spindle target, OneWay profile cutting, Tool diameter % roughing step-over, and zero cutter compensation offset. The report does not edit CAM settings, inspect generated G-code, infer material, or read spreadsheet rules.

## Use

1. [Install FRC4419 CAM Studio Checker from the Chrome Web Store](https://chromewebstore.google.com/detail/oegpilpfacppnakopiiahhalepflpglc).
2. Open an Onshape CAM Studio tab for a document you can access.
3. Click the extension icon to open the side panel.
4. Click **Connect** and authorize Onshape in the new tab. Close that tab when it says the connection succeeded.
5. Return to the side panel. When it says **Press Run**, click **Run** to read the report. Click **Status** to check the connection.
6. If Machine Output unit shows Imperial, switch it to Metric in Onshape.

Click **Disconnect** to remove this browser's saved checker connection. Click **Connect** to reconnect.

The report version appears beside the extension name in the side panel. It is maintained in [CamReport.gs](../CamReport.gs); the current report version is 1.58.

## Run from source

1. Keep the extension files in this directory together, with `manifest.json` at the directory root.
2. In Chrome, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and select this directory.
3. The packaged `background.js` points to the team's Google Apps Script web app. To use your own backend, copy `Code.gs`, `CamReport.gs`, and `CallbackIcon.gs` from the parent `apps-script` directory into the same Apps Script project. Deploy the project as a web app, save the Onshape client ID and secret in Script Properties, configure the Onshape OAuth redirect URI to the deployed `/exec` URL, then set `BACKEND_URL` in `background.js` to that URL. Keep the secret in Script Properties rather than in extension source.
4. For the team's production backend, changes to the Apps Script source on `main` are synced and published by the **Sync Apps Script** GitHub Action. See the [sync guide](../SYNCING.md). Updating Apps Script report code does not require republishing the extension. Changes to extension files require reloading the unpacked extension for local testing and a new Chrome Web Store submission for store users.

The extension source contains no Onshape client secret. Its Onshape authorization and CAM report requests are handled by the Apps Script backend.