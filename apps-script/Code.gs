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
    if (action !== "read" && action !== "report") throw new Error("Unknown action.");
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
    if (action === "report") {
      if (response.getResponseCode() !== 200) {
        throw new Error("CAM read returned HTTP " + response.getResponseCode() + ".");
      }
      let cam;
      try { cam = JSON.parse(text); }
      catch (_) { throw new Error("CAM data is not valid JSON."); }
      const tree = decodeCamTree_(cam.tree);
      const bodyLookup = currentJobBodyNames_(cam, ids, grant.accessToken, tree);
      return json_({
        reportText: renderCamReport(cam, bodyLookup.namesByJob, tree, bodyLookup.resolvedByJob),
        reportVersion: CAM_REPORT_VERSION
      });
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

// Decode Onshape's typed BTJ tree once; empty data arrays represent empty lists.
function decodeCamTree_(value) {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (Object.prototype.hasOwnProperty.call(value, "message")) {
    const message = value.message;
    if (message && Object.prototype.hasOwnProperty.call(message, "value")) {
      return decodeCamTree_(message.value);
    }
    if (message && Array.isArray(message.data)) {
      const data = message.data;
      if (data.length > 0 && data.every(function (item) {
        return item && typeof item === "object" &&
          Object.prototype.hasOwnProperty.call(item, "key") &&
          Object.prototype.hasOwnProperty.call(item, "value");
      })) {
        const object = {};
        data.forEach(function (item) { object[item.key] = decodeCamTree_(item.value); });
        return object;
      }
      return data.map(decodeCamTree_);
    }
  }
  if (Array.isArray(value)) return value.map(decodeCamTree_);
  const result = {};
  Object.keys(value).forEach(function (key) { result[key] = decodeCamTree_(value[key]); });
  return result;
}

// Resolve selected CAM bodies in two batched Onshape request phases.
function currentJobBodyNames_(cam, ids, accessToken, decodedTree) {
  const tree = decodedTree || decodeCamTree_(cam.tree);
  const jobs = tree && Array.isArray(tree.jobs) ? tree.jobs : [];
  const components = tree && Array.isArray(tree.components) ? tree.components : [];
  const componentByNodeId = Object.create(null);
  const componentByReferenceId = Object.create(null);
  components.forEach(function (component) {
    if (component && component._nodeId) componentByNodeId[component._nodeId] = component;
    if (component && component.referenceId) componentByReferenceId[component.referenceId] = component;
  });

  const headers = { Authorization: "Bearer " + accessToken, Accept: "application/json" };
  const recordsByJob = jobs.map(function (job) {
    const selections = job.selectionParameters &&
      job.selectionParameters.bodies &&
      job.selectionParameters.bodies.associativeSelections;
    if (!Array.isArray(selections)) return [];
    return selections.map(function (selection) {
      const component = componentByNodeId[selection.componentId] ||
        componentByReferenceId[selection.componentRef];
      const refId = selection.componentRef || (component && component.referenceId);
      const validRefId = typeof refId === "string" && /^[0-9a-f]{24}$/i.test(refId);
      return {
        selection: selection,
        fallback: component && component.name,
        refUrl: validRefId
          ? API_ENDPOINT + "/appelements/d/" + ids.documentId +
            "/w/" + ids.workspaceId + "/e/" + ids.elementId + "/references/" + refId
          : null
      };
    });
  });

  function fetchJsonBatch(urls) {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    const results = Object.create(null);
    for (let start = 0; start < uniqueUrls.length; start += 50) {
      const batchUrls = uniqueUrls.slice(start, start + 50);
      try {
        const responses = UrlFetchApp.fetchAll(batchUrls.map(function (url) {
          return { url: url, headers: headers, muteHttpExceptions: true };
        }));
        batchUrls.forEach(function (url, index) {
          try {
            const response = responses[index];
            if (response && response.getResponseCode() === 200) {
              results[url] = JSON.parse(response.getContentText());
            }
          } catch (_) {}
        });
      } catch (_) {
        // Keep fallback names available if this batch fails.
      }
    }
    return results;
  }

  const allRecords = recordsByJob.flat();
  const referenceByUrl = fetchJsonBatch(allRecords.map(function (record) {
    return record.refUrl;
  }));

  allRecords.forEach(function (record) {
    const ref = record.refUrl && referenceByUrl[record.refUrl];
    if (!ref || !ref.targetElementId || !/^[0-9a-f]{24}$/i.test(ref.targetElementId)) return;
    const documentId = ref.targetDocumentId || ids.documentId;
    if (!/^[0-9a-f]{24}$/i.test(documentId)) return;
    const revision = ref.targetVersionId ? "v/" + ref.targetVersionId : "w/" + ids.workspaceId;
    record.partsUrl = API_ENDPOINT + "/parts/d/" + documentId + "/" + revision +
      "/e/" + ref.targetElementId;
  });

  const partsByUrl = fetchJsonBatch(allRecords.map(function (record) {
    return record.partsUrl;
  }));
  const namesByJob = [];
  const resolvedByJob = [];

  recordsByJob.forEach(function (records, jobIndex) {
    namesByJob[jobIndex] = [];
    resolvedByJob[jobIndex] = [];
    records.forEach(function (record) {
      let name = record.fallback;
      let resolved = false;
      const ref = record.refUrl && referenceByUrl[record.refUrl];
      const parts = record.partsUrl && partsByUrl[record.partsUrl];
      if (ref && Array.isArray(parts)) {
        const identities = [ref.partIdentity, record.selection.associativityIdBodyId]
          .filter(function (id) { return typeof id === "string" && id.length > 0; });
        const matched = parts.find(function (part) {
          return identities.some(function (id) {
            return part.partIdentity === id || part.partId === id || part.id === id;
          });
        }) || (parts.length === 1 ? parts[0] : null);
        if (matched && typeof matched.name === "string" && matched.name.trim()) {
          name = matched.name;
          resolved = true;
        }
      }
      namesByJob[jobIndex].push(name);
      resolvedByJob[jobIndex].push(resolved);
    });
  });

  return { namesByJob: namesByJob, resolvedByJob: resolvedByJob };
}
