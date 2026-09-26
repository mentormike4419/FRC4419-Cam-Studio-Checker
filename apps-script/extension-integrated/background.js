const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyHX5m2OV-03a9r9rII3IIz3rbRJz-xJrr3DZLTxp46R7ZKwRl2k48LoUMxcl-wBxjmHQ/exec";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => console.error("Could not configure CAM side panel:", error));

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!["begin", "status", "check", "report", "disconnect"].includes(message.action)) return;
  sendToBackend(message).then(respond).catch(error => respond({ error: String(error) }));
  return true;
});

async function sendToBackend(message) {
  let { connectionKey } = await chrome.storage.local.get("connectionKey");
  if (!connectionKey) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    connectionKey = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    await chrome.storage.local.set({ connectionKey });
  }
  const response = await fetch(BACKEND_URL, {
    method: "POST", credentials: "omit", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...message, connectionKey })
  });
  const body = await response.text();
  try { return JSON.parse(body); }
  catch (_) {
    return { error: "Apps Script returned non-JSON HTTP " + response.status,
             responseType: response.headers.get("content-type") };
  }
}
