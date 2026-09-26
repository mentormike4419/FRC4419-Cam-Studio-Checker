# Privacy policy — FRC4419 CAM Studio Checker

Effective September 25, 2026

FRC4419 CAM Studio Checker reads settings from an Onshape CAM Studio and shows them in a Chrome side panel.

## Data used

When you request a report, the extension reads the active tab URL to obtain the Onshape document, workspace, and element identifiers. It sends those identifiers and a browser-specific connection key to the project's Google Apps Script web app. The web app uses your Onshape authorization to retrieve the CAM Studio JSON and returns it to the extension for display. This can include document content such as machine, setup, tool, and operation settings.

When you connect, the web app obtains and stores your Onshape account ID, email address, and OAuth access and refresh tokens in Google Apps Script properties associated with the connection key. The extension stores the connection key in Chrome local storage. The web app uses these values to keep the browser connected and read CAM data you request.

## Use and sharing

The data is used to authorize your connection and display your CAM Studio report. It is processed through Google Apps Script and Onshape for that purpose. We do not sell user data, use it for advertising, collect payment or health information, or use it to determine creditworthiness. The extension does not include analytics.

## Control and retention

Click **Forget grant** in the side panel to delete the associated Onshape grant stored by the Apps Script backend. You can reconnect later. The browser's local connection key may remain in Chrome storage; removing the extension deletes its local storage. You can separately revoke the app's Onshape authorization in your Onshape account. We do not intentionally retain CAM Studio report data after returning it to your browser.

## Contact

For questions about this policy, contact mentormike4419@gmail.com.

The use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including its Limited Use requirements.