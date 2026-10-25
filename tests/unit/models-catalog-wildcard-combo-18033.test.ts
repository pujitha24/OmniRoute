/**
 * #18033 — a combo made only of provider wildcards routes fine (dispatch expands them against
 * the synced catalog) but was missing from `/v1/models`, because the catalog resolved the stored
 * wildcard step without expanding it and skipped combos with zero resolved targets.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-catalog-wildcard-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = process.env.API_KEY_SECRET || "catalog-wildcard-test-secret";

const core = await import("../../src/lib/db/core.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const settingsDb = await import("../../src/lib/db/settings.ts");
const combosDb = await import("../../src/lib/db/combos.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const v1ModelsCatalog = await import("../../src/app/api/v1/models/catalog.ts");

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function listIds(): Promise<Set<string>> {
  const response = await v1ModelsCatalog.getUnifiedModelsResponse(
    new Request("http://localhost/api/v1/models")
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: Array<{ id: string }> };
  return new Set(body.data.map((m) => m.id));
}

test("#18033 wildcard-only combo is listed in /v1/models", async () => {
  await settingsDb.updateSettings({ requireLogin: false });
  const conn = await providersDb.createProviderConnection({
    provider: "groq",
    authType: "apikey",
    apiKey: "sk-test-18033",
    name: "test-18033",
    isActive: true,
  });
  await modelsDb.replaceSyncedAvailableModelsForConnection("groq", conn.id, [
    { id: "openai/gpt-oss-20b", name: "gpt-oss-20b", source: "imported" as const },
  ]);
  await combosDb.createCombo({
    name: "wildcard-repro",
    strategy: "auto",
    models: ["groq/openai/gpt-oss-*"],
  });
  await combosDb.createCombo({
    name: "wildcard-nomatch",
    strategy: "priority",
    models: ["groq/nonexistent-*"],
  });

  const ids = await listIds();
  assert.ok(ids.has("wildcard-repro"), "wildcard-only combo must be advertised");
  assert.ok(!ids.has("wildcard-nomatch"), "wildcard with no synced match stays unlisted");
});
