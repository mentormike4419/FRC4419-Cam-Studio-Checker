# FRC4419 CAM Studio Checker

A Chrome extension for FRC 4419 and other Onshape CAM learners. It opens beside the active CAM Studio and displays its current settings. The report lists selected Job bodies and Stock Direction Type, and checks whether the machine Output unit is Metric.

This prototype is a read-only report. It shows job bodies, stock direction, the machine output unit, setups, tools, and operations. Setup Work Plane fields are omitted. Lengths appear as Inch (MM), and feeds as Inch/min (MM/min). It does not change CAM settings, inspect generated G-code, infer material, or apply spreadsheet rules.

## How to use

1. [Install FRC4419 CAM Studio Checker from the Chrome Web Store](https://chromewebstore.google.com/detail/oegpilpfacppnakopiiahhalepflpglc) once the listing is approved and live.
2. Open an Onshape CAM Studio workspace tab for a document you can access.
3. Click the extension icon to open the side panel.
4. Click **Connect**, authorize your Onshape account in the new tab, and close that tab when it says the connection succeeded.
5. Back in the side panel, click **Status**, then **Show CAM settings**.
6. Review the report. If Machine Output unit shows Imperial, switch it to Metric in Onshape.

**Forget grant** removes this browser's saved authorization on the Apps Script backend. You can reconnect later.

## Source and documentation

- [Current extension source](apps-script/extension-integrated/) — the version 0.3.4 release candidate; version 0.3.3 is currently under Web Store review.
- [Extension details](apps-script/extension-integrated/README.md) — scope, units, and installation notes.
- [Apps Script report formatter](apps-script/CamReport.gs) — controls the text shown in the side panel.
- [Privacy policy](PRIVACY.md).

The extension communicates with a Google Apps Script web app to authorize Onshape, read CAM settings, and format the side panel report. `Code.gs` retains the original JSON response for version 0.3.3 while also returning report text for the next extension version. The release's web app URL is configured in `background.js`. Source is provided for learning and inspection; installing from the Chrome Web Store is the simplest way to use the team's deployment.