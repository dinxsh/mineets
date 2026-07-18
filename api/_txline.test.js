import assert from "node:assert/strict";
import test from "node:test";
import { getServerConfig, readinessPayload } from "./_txline.js";

test("server config reports missing TxLINE secrets without exposing values", () => {
  const previousJwt = process.env.TXLINE_JWT;
  const previousToken = process.env.TXLINE_API_TOKEN;
  delete process.env.TXLINE_JWT;
  delete process.env.TXLINE_API_TOKEN;

  const readiness = readinessPayload();

  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missing, ["jwt", "api token"]);
  assert.equal("guestJwt" in readiness, false);
  assert.equal("apiToken" in readiness, false);

  restoreEnv("TXLINE_JWT", previousJwt);
  restoreEnv("TXLINE_API_TOKEN", previousToken);
});

test("server config uses documented TxLINE hosts by network", () => {
  const previousNetwork = process.env.TXLINE_NETWORK;
  const previousOrigin = process.env.TXLINE_ORIGIN;
  delete process.env.TXLINE_ORIGIN;

  process.env.TXLINE_NETWORK = "mainnet";
  assert.equal(getServerConfig().apiBaseUrl, "https://txline.txodds.com/api");

  process.env.TXLINE_NETWORK = "devnet";
  assert.equal(getServerConfig().apiBaseUrl, "https://txline-dev.txodds.com/api");

  restoreEnv("TXLINE_NETWORK", previousNetwork);
  restoreEnv("TXLINE_ORIGIN", previousOrigin);
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
