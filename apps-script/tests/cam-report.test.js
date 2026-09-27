const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appScriptDir = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(appScriptDir, "Code.gs"), "utf8");
const report = fs.readFileSync(path.join(appScriptDir, "CamReport.gs"), "utf8");
const callbackIcon = fs.readFileSync(path.join(appScriptDir, "CallbackIcon.gs"), "utf8");

function makeContext(fetchAll) {
  const context = { UrlFetchApp: { fetchAll } };
  vm.createContext(context);
  vm.runInContext(code + "\n" + report + "\n" + callbackIcon, context);
  return context;
}

function apiResponse(value) {
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify(value)
  };
}

function makeCam() {
  const documentId = "d".repeat(24);
  const workspaceId = "w".repeat(24);
  const elementId = "e".repeat(24);
  const selections = [
    { componentId: "node-a", componentRef: "a".repeat(24), associativityIdBodyId: "part-a" },
    { componentId: "node-b", componentRef: "b".repeat(24), associativityIdBodyId: "part-b" }
  ];
  const tree = {
    components: [
      { _nodeId: "node-a", referenceId: selections[0].componentRef, name: "CAM Body A" },
      { _nodeId: "node-b", referenceId: selections[1].componentRef, name: "CAM Body B" }
    ],
    jobs: [{
      name: "Job",
      selectionParameters: { bodies: { associativeSelections: selections } },
      operations: [],
      stock: { directionType: "World" }
    }]
  };
  return { ids: { documentId, workspaceId, elementId }, tree, selections };
}

test("body-name resolution batches references and part lists", () => {
  const { ids, tree, selections } = makeCam();
  const fetchBatches = [];
  const context = makeContext(requests => {
    fetchBatches.push(requests);
    return requests.map(request => {
      if (request.url.includes("/references/")) {
        const isA = request.url.endsWith("a".repeat(24));
        return apiResponse({
          targetDocumentId: ids.documentId,
          targetElementId: isA ? "1".repeat(24) : "2".repeat(24),
          targetVersionId: isA ? "rev-a" : "rev-b",
          partIdentity: isA ? "part-a" : "part-b"
        });
      }
      return apiResponse([
        { partIdentity: "part-a", name: "Drive Side Plate" },
        { partIdentity: "part-b", name: "Support Bracket" }
      ]);
    });
  });

  const result = context.currentJobBodyNames_({ tree }, ids, "token", tree);
  assert.deepEqual(fetchBatches.map(batch => batch.length), [2, 2]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.namesByJob)), [["Drive Side Plate", "Support Bracket"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.resolvedByJob)), [[true, true]]);
  assert.equal(selections.length, 2);
});

test("failed lookups preserve component names and mark them in the report", () => {
  const { ids, tree } = makeCam();
  const context = makeContext(() => { throw new Error("Onshape lookup failed"); });
  const result = context.currentJobBodyNames_({ tree }, ids, "token", tree);
  const text = context.renderCamReport({ tree }, result.namesByJob, tree, result.resolvedByJob);

  assert.deepEqual(JSON.parse(JSON.stringify(result.namesByJob)), [["CAM Body A", "CAM Body B"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.resolvedByJob)), [[false, false]]);
  assert.match(text, /Bodies: CAM Body A \(CAM fallback\), CAM Body B \(CAM fallback\)/);
});

test("resolved current body names appear without fallback labels", () => {
  const { ids, tree } = makeCam();
  const context = makeContext(requests => requests.map(request => {
    if (request.url.includes("/references/")) {
      const isA = request.url.endsWith("a".repeat(24));
      return apiResponse({
        targetDocumentId: ids.documentId,
        targetElementId: isA ? "1".repeat(24) : "2".repeat(24),
        partIdentity: isA ? "part-a" : "part-b"
      });
    }
    const isA = request.url.endsWith("1".repeat(24));
    return apiResponse([{ partIdentity: isA ? "part-a" : "part-b", name: isA ? "Panel" : "Block" }]);
  }));
  const result = context.currentJobBodyNames_({ tree }, ids, "token", tree);
  const text = context.renderCamReport({ tree }, result.namesByJob, tree, result.resolvedByJob);

  assert.match(text, /Bodies: Panel, Block/);
  assert.doesNotMatch(text, /CAM fallback/);
});
