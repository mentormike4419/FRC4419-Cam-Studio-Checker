const statusElement = document.getElementById("status");
const reportElement = document.getElementById("report");
const reportVersionElement = document.getElementById("reportVersion");

function setStatus(message) { statusElement.textContent = message; }
function call(action, extra = {}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ action, ...extra }, data => {
    resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : data);
  }));
}
async function activeCamIds() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const match = (tab?.url || "").match(/\/documents\/([0-9a-f]{24})\/w\/([0-9a-f]{24})\/e\/([0-9a-f]{24})/i);
  if (!match) throw new Error("🟡 Open an Onshape CAM Studio tab, then click Show CAM settings.");
  return { documentId: match[1], workspaceId: match[2], elementId: match[3] };
}
async function showCamSettings() {
  reportElement.textContent = "";
  reportVersionElement.textContent = "v—";
  setStatus("Reading the active CAM Studio tab...");
  try {
    const data = await call("report", {
      ...(await activeCamIds()),
      clientVersion: chrome.runtime.getManifest().version
    });
    if (!data || data.error) throw new Error(data?.error || "No response from Apps Script.");
    if (typeof data.reportText !== "string") throw new Error("Apps Script did not return a CAM report. Deploy the latest Code.gs and CamReport.gs.");
    const versionMatch = data.reportText.match(/^REPORT VERSION:\s*([^\r\n]+)/m);
    reportVersionElement.textContent = data.reportVersion
      ? "v" + data.reportVersion
      : versionMatch ? "v" + versionMatch[1].trim() : "v?";
    reportElement.textContent = data.reportText.replace(/^REPORT VERSION:[^\r\n]*\r?\n?/m, "");
    setStatus("CAM report ready. Review the settings below.");
  } catch (error) { setStatus(error.message); }
}
document.getElementById("connect").onclick = async () => {
  setStatus("Starting Onshape authorization...");
  const data = await call("begin");
  if (data?.authorizationUrl) {
    chrome.tabs.create({ url: data.authorizationUrl });
    setStatus("Authorize in the new tab, then return and click Status.");
  } else setStatus(data?.error || "Could not start authorization.");
};
document.getElementById("statusButton").onclick = async () => {
  const data = await call("status");
  setStatus(data?.error || (data?.connected ? "Connected to Onshape." : "Not connected."));
};
document.getElementById("reportButton").onclick = showCamSettings;
document.getElementById("disconnect").onclick = async () => {
  const data = await call("disconnect");
  reportElement.textContent = "";
  setStatus(data?.error || "This browser's grant was forgotten.");
};
document.getElementById("statusButton").click();
