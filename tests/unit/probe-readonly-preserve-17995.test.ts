import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

const { isNonCorruptionProbeError } = await import("../../src/lib/db/probeUtils.ts");

test("real SQLITE_READONLY error is a non-corruption probe error (#17995)", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('x'); PRAGMA query_only=ON;");
  let err: unknown;
  try {
    db.prepare("UPDATE t SET v='changed'").run();
  } catch (e) {
    err = e;
  } finally {
    db.close();
  }
  assert.ok(err, "expected a readonly error");
  assert.equal(isNonCorruptionProbeError(err), true);
});

test("BUSY/IOERR/PROTOCOL count as non-corruption; corruption and ENOENT do not (#17995)", () => {
  for (const m of [
    "SQLITE_BUSY: database is locked",
    "SQLITE_IOERR: disk I/O error",
    "SQLITE_PROTOCOL",
  ]) {
    assert.equal(isNonCorruptionProbeError(new Error(m)), true, m);
  }
  assert.equal(isNonCorruptionProbeError({ errcode: 8 }), true);
  for (const m of [
    "file is not a database",
    "database disk image is malformed",
    "ENOENT: no such file",
  ]) {
    assert.equal(isNonCorruptionProbeError(new Error(m)), false, m);
  }
});
