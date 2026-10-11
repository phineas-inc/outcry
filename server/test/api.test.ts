import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { openNodeDb } from "../src/db.ts";

const app = createApp({ db: openNodeDb(":memory:") });
const H = { "X-Device-Id": "test-device-0123456789", "Content-Type": "application/json" };
const post = (path: string, body: unknown) => app.request(path, { method: "POST", headers: H, body: JSON.stringify(body) });

test("lists seeded protests", async () => {
  const list = await (await app.request("/api/protests")).json();
  assert.ok(list.length >= 20);
});

test("rejects strong votes until all perspectives are read, then charges n² Voice", async () => {
  const id = "paris-pensions";
  assert.equal((await post(`/api/protests/${id}/votes`, { kind: "cause", direction: 1, strength: 3 })).status, 403);
  for (const lean of ["Left", "Center", "Right"]) await post(`/api/protests/${id}/reads`, { lean });
  const res = await post(`/api/protests/${id}/votes`, { kind: "cause", direction: 1, strength: 3 });
  assert.equal(res.status, 200);
  const { me } = await res.json();
  assert.equal(me.credits, 1);
  assert.equal(me.xp, 35);
  assert.equal(me.streak, 1);
  assert.equal((await post(`/api/protests/${id}/votes`, { kind: "action", direction: -1, strength: 2 })).status, 402);
});

test("requires a device id", async () => {
  assert.equal((await app.request("/api/me")).status, 400);
});

test("concurrent votes cannot overspend the daily Voice budget", async () => {
  const H2 = { "X-Device-Id": "race-device-0123456789", "Content-Type": "application/json" };
  const id = "berlin-rent";
  for (const lean of ["Left", "Center", "Right"]) await app.request(`/api/protests/${id}/reads`, { method: "POST", headers: H2, body: JSON.stringify({ lean }) });
  const res = await Promise.all(Array.from({ length: 6 }, () => app.request(`/api/protests/${id}/votes`, { method: "POST", headers: H2, body: JSON.stringify({ kind: "cause", direction: 1, strength: 2 }) })));
  assert.equal(res.filter((r) => r.status === 200).length, 2); // 4 + 4 = 8 of 10; a third would need 12
  const me = await (await app.request("/api/me", { headers: H2 })).json();
  assert.equal(me.credits, 2);
});
