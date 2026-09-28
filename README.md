# FRC4419 CAM Studio Checker

A Chrome extension for FRC 4419 and other Onshape CAM learners. It opens beside the active CAM Studio and displays a read-only report of its current settings.

The report lists selected Job bodies and Stock Direction Type, the machine Output unit, setups, tools, and operations. It includes built-in indicators for the Metric machine output setting and selected drilling and milling settings. Lengths are shown as Inch (MM), and feeds as Inch/min (MM/min). It does not change CAM settings, inspect generated G-code, infer material, or apply spreadsheet rules.

## How to use

1. [Install FRC4419 CAM Studio Checker from the Chrome Web Store](https://chromewebstore.google.com/detail/oegpilpfacppnakopiiahhalepflpglc).
2. Open an Onshape CAM Studio tab for a document you can access.
3. Click the extension icon to open the side panel.
4. Click **Connect**, authorize your Onshape account in the new tab, then close that tab when it says the connection succeeded.
5. Return to the side panel. When it says **Press Run**, click **Run**. Click **Status** if you want to check the connection.
6. Review the report. If Machine Output unit shows Imperial, switch it to Metric in Onshape.

**Disconnect** removes the checker's saved Onshape connection for this browser. Click **Connect** to connect again.

## Maintaining the Apps Script connection

The production GitHub Action syncs the Apps Script files into the existing project and publishes a new version to the existing web app URL. Changes to `apps-script/Code.gs`, `apps-script/CamReport.gs`, or `apps-script/CallbackIcon.gs` on `main` start the sync automatically. You can also run **Actions → Sync Apps Script** manually. For setup and troubleshooting, see the [sync guide](apps-script/SYNCING.md). The sync uses repository Actions secrets; do not put secret values in source files or documentation. Turn off the Apps Script API in your Google account settings if the GitHub sync is no longer in use.

Changing the Apps Script report does not require a Chrome Web Store update. Changes to the extension itself require a new extension package and Web Store submission.

## Source and documentation

- [Published extension source](apps-script/extension-integrated/) — version 0.3.19.
- [Extension details and usage](apps-script/extension-integrated/README.md).
- [Apps Script report formatter](apps-script/CamReport.gs) — controls the text shown in the side panel. Current report version: 1.61.
- [Privacy policy](PRIVACY.md).

The extension reads the active CAM Studio URL and sends its document, workspace, and element IDs to the Apps Script backend. The backend authorizes Onshape, reads the CAM data, and builds the report text. The side panel displays that report. Source is provided for learning and inspection; installing from the Chrome Web Store is the simplest way to use the team's deployment.