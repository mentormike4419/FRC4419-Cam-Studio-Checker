// Current CAM Studio Checker backend: Onshape grant and CAM settings report.
// Changes to this production file sync and publish through GitHub Actions.
// Credentials stay in ONSHAPE_CLIENT_ID and ONSHAPE_CLIENT_SECRET Script Properties.
const AUTH_ENDPOINT = "https://oauth.onshape.com/oauth/authorize";
const TOKEN_ENDPOINT = "https://oauth.onshape.com/oauth/token";
const API_ENDPOINT = "https://cad.onshape.com/api";

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.code && !p.error) return callbackPage_("FRC4419 CAM Studio Checker", "Web app ready", "Open CAM Studio, then use the checker side panel to connect or read settings.");
  try {
    if (p.error) throw new Error("Onshape authorization denied.");
    const stateKey = "state:" + (p.state || "");
    const cache = CacheService.getScriptCache();
    const connection = cache.get(stateKey);
    if (!connection) throw new Error("Connection attempt expired or state did not match.");
    cache.remove(stateKey);
    const config = oauthConfig_();
    const reply = UrlFetchApp.fetch(TOKEN_ENDPOINT, {
      method: "post", contentType: "application/x-www-form-urlencoded",
      headers: { Authorization: "Basic " + Utilities.base64Encode(config.id + ":" + config.secret),
                 Accept: "application/json" },
      payload: form_({ grant_type: "authorization_code", code: p.code,
                       redirect_uri: callbackUrl_() }),
      muteHttpExceptions: true
    });
    if (reply.getResponseCode() !== 200) throw new Error("Token exchange HTTP " + reply.getResponseCode());
    const token = JSON.parse(reply.getContentText());
    if (!token.access_token) throw new Error("No access token returned.");
    const profileResponse = UrlFetchApp.fetch(API_ENDPOINT + "/users/sessioninfo", {
      headers: { Authorization: "Bearer " + token.access_token, Accept: "application/json" },
      muteHttpExceptions: true
    });
    if (profileResponse.getResponseCode() !== 200) {
      throw new Error("Account lookup HTTP " + profileResponse.getResponseCode());
    }
    const profile = JSON.parse(profileResponse.getContentText());
    if (!profile.id) throw new Error("Account lookup omitted user ID.");
    const grant = {
      accessToken: token.access_token, refreshToken: token.refresh_token || "",
      expiresAt: Date.now() + (Number(token.expires_in || 3600) - 60) * 1000,
      userId: profile.id, email: profile.email || ""
    };
    PropertiesService.getScriptProperties().setProperty(connection, JSON.stringify(grant));
    return callbackPage_("Connection successful", "CLOSE THIS TAB", "Return to CAM Studio. In the checker side panel, click Status, then Show CAM settings.", { account: profile.email || profile.id, clientId: config.id });
  } catch (error) {
    return callbackPage_("Connection failed", "Try Connect again", String(error.message));
  }
}

function doPost(e) {
  try {
    const input = JSON.parse(e.postData.contents);
    const action = input.action;
    const key = connectionName_(input.connectionKey);
    if (action === "begin") {
      const config = oauthConfig_();
      const state = Utilities.getUuid();
      CacheService.getScriptCache().put("state:" + state, key, 600);
      return json_({ authorizationUrl: AUTH_ENDPOINT + "?" + form_({
        response_type: "code", client_id: config.id, redirect_uri: callbackUrl_(),
        scope: "OAuth2Read", state: state
      }) });
    }
    const props = PropertiesService.getScriptProperties();
    if (action === "disconnect") {
      props.deleteProperty(key);
      return json_({ connected: false });
    }
    const stored = props.getProperty(key);
    if (action === "status") {
      if (!stored) return json_({ connected: false });
      const grant = JSON.parse(stored);
      return json_({ connected: true, userId: grant.userId, email: grant.email });
    }
    if (action !== "read" && action !== "check" && action !== "report") throw new Error("Unknown action.");
    if (!stored) throw new Error("This installation is not connected to Onshape.");
    const ids = ids_(input);
    const grant = JSON.parse(stored);
    if (Date.now() >= grant.expiresAt) refresh_(grant, key);
    const url = API_ENDPOINT + "/appelements/d/" + ids.documentId +
      "/w/" + ids.workspaceId + "/e/" + ids.elementId + "/content/json";
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + grant.accessToken, Accept: "application/json" },
      muteHttpExceptions: true
    });
    const text = response.getContentText();
    if (action === "check") return json_(checkRule_(text, response.getResponseCode()));
    if (action === "report") {
      if (response.getResponseCode() !== 200) {
        throw new Error("CAM read returned HTTP " + response.getResponseCode() + ".");
      }
      if (!isJson_(text)) throw new Error("CAM data is not valid JSON.");
      const cam = JSON.parse(text);
      const bodies = currentJobBodyNames_(cam, ids, grant.accessToken);
      // Retain cam for extensions already submitted to the Web Store.
      return json_({ cam: cam, reportText: renderCamReport(cam, bodies.namesByJob),
        onshapeRequests: 1 + bodies.requests });
    }
    return json_({
      connected: true, userId: grant.userId, email: grant.email,
      camStatus: response.getResponseCode(),
      json: response.getResponseCode() === 200 && isJson_(text),
      characters: text.length
    });
  } catch (error) {
    return json_({ error: String(error.message) });
  }
}

function refresh_(grant, key) {
  if (!grant.refreshToken) throw new Error("Grant expired without a refresh token.");
  const config = oauthConfig_();
  const response = UrlFetchApp.fetch(TOKEN_ENDPOINT, {
    method: "post", contentType: "application/x-www-form-urlencoded",
    payload: form_({
      grant_type: "refresh_token", refresh_token: grant.refreshToken,
      client_id: config.id, client_secret: config.secret
    }), muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error("Refresh HTTP " + response.getResponseCode());
  const next = JSON.parse(response.getContentText());
  if (!next.access_token) throw new Error("Refresh omitted access token.");
  grant.accessToken = next.access_token;
  grant.refreshToken = next.refresh_token || grant.refreshToken;
  grant.expiresAt = Date.now() + (Number(next.expires_in || 3600) - 60) * 1000;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(grant));
}

function connectionName_(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("Invalid installation connection key.");
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return "grant:" + digest.map(function (byte) {
    return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join("");
}
function ids_(p) {
  const ids = { documentId: p.documentId, workspaceId: p.workspaceId, elementId: p.elementId };
  Object.keys(ids).forEach(function (k) {
    if (typeof ids[k] !== "string" || !/^[0-9a-f]{24}$/i.test(ids[k])) throw new Error("Invalid " + k);
  });
  return ids;
}
function oauthConfig_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("ONSHAPE_CLIENT_ID");
  const secret = props.getProperty("ONSHAPE_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Onshape Script Properties are missing.");
  return { id: id, secret: secret };
}
function callbackUrl_() {
  const url = ScriptApp.getService().getUrl();
  if (!url || !url.endsWith("/exec")) throw new Error("Use the deployed /exec URL.");
  return url;
}
function form_(fields) {
  return Object.keys(fields).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(fields[k]);
  }).join("&");
}
function isJson_(text) { try { JSON.parse(text); return true; } catch (_) { return false; } }
const CALLBACK_ICON_BASE64 = "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";

function callbackPage_(title, action, detail, technical) {
  const isError = title === "Connection failed";
  const accent = isError ? "#b63a2b" : "#157e47";
  const pale = isError ? "#fff0ed" : "#eaf7ef";
  const symbol = isError ? "!" : "✓";
  const technicalHtml = technical
    ? '<p class="account">Connected Onshape account: <strong>' +
      html_(technical.account) + '</strong></p>' +
      '<details class="technical"><summary>Technical details</summary>' +
      '<p>OAuth client ID: <code>' + html_(technical.clientId) +
      '</code></p></details>'
    : '';
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FRC4419 CAM Studio Checker — ${html_(title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f2f5f7;color:#182332;font:16px/1.5 Arial,sans-serif}
main{max-width:660px;margin:48px auto;padding:0 20px}
.card{overflow:hidden;background:#fff;border:1px solid #d9e2e8;border-radius:18px;box-shadow:0 12px 34px rgba(18,38,53,.12)}
.brand{display:flex;align-items:center;gap:15px;padding:22px 28px;border-bottom:1px solid #e2e9ee}
.brand img{width:70px;height:70px;object-fit:contain}
.brand strong{display:block;font-size:19px;line-height:1.25}
.brand span{display:block;color:#566779;font-size:14px;margin-top:3px}
.content{padding:32px 28px 36px}
.status{display:inline-block;border-radius:999px;background:${pale};color:${accent};font-size:15px;font-weight:bold;padding:6px 13px}
h1{font-size:29px;line-height:1.2;margin:18px 0 8px}
.action{color:${accent};font-size:24px;font-weight:800;letter-spacing:.03em;margin:14px 0}
.detail{color:#3e4b59;margin:0}
.account{margin:20px 0 0;font-size:14px}
.technical{margin-top:18px;border-top:1px solid #e2e9ee;padding-top:14px;color:#566779;font-size:13px}
.technical summary{cursor:pointer}
.technical code{overflow-wrap:anywhere}
@media(max-width:500px){main{margin:16px auto}.brand{padding:17px}.content{padding:24px 18px}h1{font-size:25px}}
</style></head><body><main><div class="card">
<div class="brand"><img alt="CAM Studio Checker icon" src="data:image/png;base64,${CALLBACK_ICON_BASE64}">
<div><strong>FRC4419 CAM Studio Checker</strong><span>Onshape CAM connection</span></div></div>
<div class="content"><div class="status">${symbol} ${html_(title)}</div>
<h1>${html_(title)}</h1><p class="action">${html_(action)}</p>
<p class="detail">${html_(detail)}</p>${technicalHtml}</div></div></main></body></html>`;
  return HtmlService.createHtmlOutput(page).setTitle("FRC4419 CAM Studio Checker");
}
function html_(value) {
  return String(value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkRule_(camText, camStatus) {
  if (camStatus !== 200) return {
    status: "REVIEW", explanation: "CAM read returned HTTP " + camStatus + "."
  };
  const sheetId = PropertiesService.getScriptProperties().getProperty("RULE_SHEET_ID");
  if (!sheetId) return { status: "REVIEW", explanation: "RULE_SHEET_ID is not configured." };
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName("Rules");
  if (!sheet) return { status: "REVIEW", explanation: "Rules tab was not found." };
  const row = sheet.getRange("A2:G2").getValues()[0];
  const ruleId = row[0], operationName = row[1], path = row[2];
  const maximum = row[3], unit = row[4], use = row[5];
  if (!ruleId || !operationName || !path || typeof maximum !== "number" ||
      !Number.isFinite(maximum)) {
    return { status: "REVIEW", explanation: "Sheet rule is incomplete or invalid." };
  }
  let cam;
  try { cam = JSON.parse(camText); }
  catch (_) { return { status: "REVIEW", explanation: "CAM data is not valid JSON." }; }
  // The App Element response is typed; the saved CAM export is the decoded tree.
  const tree = decodeCamTree_(cam.tree);
  const matches = (tree && Array.isArray(tree.jobs) ? tree.jobs : [])
    .flatMap(function (job) { return job.operations || []; })
    .filter(function (op) {
      return op.operationType === "ToolPath" && op.name === operationName;
    });
  if (matches.length !== 1) return {
    status: "REVIEW", ruleId: ruleId,
    explanation: "Expected one named ToolPath in the decoded CAM tree; found " +
      matches.length + "."
  };
  const value = path.split(".").reduce(function (item, part) {
    return item == null ? undefined : item[part];
  }, matches[0]);
  if (value === undefined || value === null || value === "" ||
      !Number.isFinite(Number(value))) return {
    status: "REVIEW", ruleId: ruleId,
    explanation: "Setting is missing or not numeric."
  };
  const observed = Number(value);
  return {
    status: observed <= maximum ? "PASS" : "FIX",
    ruleId: ruleId, operationName: operationName,
    observed: observed, maximum: maximum, unit: unit,
    demonstrationOnly: use === "Demo only",
    explanation: observed <= maximum ?
      "Observed value is at or below the Sheet maximum." :
      "Observed value exceeds the Sheet maximum."
  };
}

// Run once from the Apps Script editor to authorize the new Sheets scope.
function authorizeRuleSheet() {
  const id = PropertiesService.getScriptProperties().getProperty("RULE_SHEET_ID");
  if (!id) throw new Error("Set RULE_SHEET_ID in Script Properties first.");
  const sheet = SpreadsheetApp.openById(id).getSheetByName("Rules");
  if (!sheet) throw new Error("Rules tab was not found.");
  return sheet.getRange("A2").getValue();
}

// Decode the same BTJ value format used by extension/popup.js (btjToJS).
function decodeCamTree_(value) {
  if (value === null || value === undefined) return value;
  if (value.message && Object.prototype.hasOwnProperty.call(value.message, "value")) {
    return value.message.value;
  }
  const data = value.message && value.message.data;
  if (Array.isArray(data)) {
    if (data.length && data.every(function (item) {
      return item && typeof item === "object" &&
        Object.prototype.hasOwnProperty.call(item, "key") &&
        Object.prototype.hasOwnProperty.call(item, "value");
    })) {
      const result = {};
      data.forEach(function (item) { result[item.key] = decodeCamTree_(item.value); });
      return result;
    }
    return data.map(decodeCamTree_);
  }
  if (Array.isArray(value)) return value.map(decodeCamTree_);
  return value;
}

// Resolve the selected CAM body through its Onshape reference to the current part name.
function currentJobBodyNames_(cam, ids, accessToken) {
  const tree = decodeCamTree_(cam.tree);
  const jobs = tree && Array.isArray(tree.jobs) ? tree.jobs : [];
  const components = tree && Array.isArray(tree.components) ? tree.components : [];
  const headers = { Authorization: "Bearer " + accessToken, Accept: "application/json" };
  const cache = {};
  let requests = 0;

  function fetchJson(url) {
    requests++;
    const response = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    return JSON.parse(response.getContentText());
  }

  const namesByJob = jobs.map(function (job) {
    const bodies = job.selectionParameters && job.selectionParameters.bodies;
    const selections = bodies && bodies.associativeSelections;
    if (!Array.isArray(selections)) return [];
    return selections.map(function (selection) {
      const component = components.find(function (item) {
        return item._nodeId === selection.componentId;
      }) || components.find(function (item) {
        return item.referenceId === selection.componentRef;
      });
      const fallback = component && component.name;
      const refId = selection.componentRef || (component && component.referenceId);
      if (typeof refId !== "string" || !/^[0-9a-f]{24}$/i.test(refId)) return fallback;
      const cacheKey = refId + ":" + (selection.associativityIdBodyId || "");
      if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) return cache[cacheKey];
      let name = fallback;
      try {
        const ref = fetchJson(API_ENDPOINT + "/appelements/d/" + ids.documentId +
          "/w/" + ids.workspaceId + "/e/" + ids.elementId + "/references/" + refId);
        if (ref && ref.targetElementId && /^[0-9a-f]{24}$/i.test(ref.targetElementId)) {
          const did = ref.targetDocumentId || ids.documentId;
          const revision = ref.targetVersionId ? "v/" + ref.targetVersionId : "w/" + ids.workspaceId;
          if (/^[0-9a-f]{24}$/i.test(did)) {
            const parts = fetchJson(API_ENDPOINT + "/parts/d/" + did + "/" + revision +
              "/e/" + ref.targetElementId);
            if (Array.isArray(parts)) {
              const identities = [ref.partIdentity, selection.associativityIdBodyId]
                .filter(function (id) { return typeof id === "string" && id.length > 0; });
              const matched = parts.find(function (part) {
                return identities.some(function (id) {
                  return part.partIdentity === id || part.partId === id || part.id === id;
                });
              }) || (parts.length === 1 ? parts[0] : null);
              if (matched && typeof matched.name === "string" && matched.name.trim()) {
                name = matched.name;
              }
            }
          }
        }
      } catch (_) {
        // Keep the CAM component name when a reference cannot be resolved.
      }
      cache[cacheKey] = name;
      return name;
    });
  });
  return { namesByJob: namesByJob, requests: requests };
}
