import { initialMatchSnapshot, normalizeFixture, normalizeTxLine } from "../src/integrations.js";

const DEFAULT_MAINNET_ORIGIN = "https://txline.txodds.com";
const DEFAULT_DEVNET_ORIGIN = "https://txline-dev.txodds.com";

export function getServerConfig() {
  const network = process.env.TXLINE_NETWORK || "mainnet";
  const origin = stripTrailingSlash(
    process.env.TXLINE_ORIGIN || (network === "devnet" ? DEFAULT_DEVNET_ORIGIN : DEFAULT_MAINNET_ORIGIN),
  );
  const guestJwt = process.env.TXLINE_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  const serviceLevel = process.env.TXLINE_SERVICE_LEVEL || "12";
  const fixtureId = process.env.TXLINE_FIXTURE_ID;

  return {
    network,
    origin,
    apiBaseUrl: `${origin}/api`,
    guestAuthUrl: `${origin}/auth/guest/start`,
    serviceLevel,
    fixtureId,
    hasGuestJwt: hasValue(guestJwt),
    hasApiToken: hasValue(apiToken),
    configured: hasValue(guestJwt) && hasValue(apiToken),
    missing: [
      !hasValue(guestJwt) ? "TXLINE_JWT" : null,
      !hasValue(apiToken) ? "TXLINE_API_TOKEN" : null,
    ].filter(Boolean),
    guestJwt,
    apiToken,
  };
}

export function readinessPayload() {
  const config = getServerConfig();

  return {
    network: config.network,
    apiOrigin: config.origin,
    apiBaseUrl: config.apiBaseUrl,
    guestAuthUrl: config.guestAuthUrl,
    serviceLevel: config.serviceLevel,
    configured: config.configured,
    hasGuestJwt: config.hasGuestJwt,
    hasApiToken: config.hasApiToken,
    missing: config.missing.map((key) => key.replace("TXLINE_", "").toLowerCase().replace("_", " ")),
  };
}

export async function fetchServerFixtures() {
  const config = requireConfiguredTxLine();
  const payload = await txLineFetch(config, "/fixtures/snapshot");
  return listFrom(payload).map(normalizeFixture).filter(Boolean);
}

export async function fetchServerSnapshot(fixtureId) {
  if (!fixtureId) {
    throw httpError(400, "fixtureId is required");
  }

  const config = requireConfiguredTxLine();
  const [snapshotPayload, updatesPayload] = await Promise.all([
    txLineFetch(config, `/scores/snapshot/${encodeURIComponent(fixtureId)}`),
    txLineFetch(config, `/scores/updates/${encodeURIComponent(fixtureId)}`).catch(() => null),
  ]);

  return normalizeTxLine(snapshotPayload, updatesPayload, initialMatchSnapshot, fixtureId);
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export function handleApiError(response, error) {
  const statusCode = error.statusCode || 500;
  sendJson(response, statusCode, {
    error: {
      message: error.expose ? error.message : "Backend feed request failed",
      statusCode,
    },
  });
}

function requireConfiguredTxLine() {
  const config = getServerConfig();
  if (!config.configured) {
    throw httpError(503, `Missing backend env: ${config.missing.join(", ")}`);
  }
  return config;
}

async function txLineFetch(config, path) {
  const url = `${config.apiBaseUrl}${pathWithServiceLevel(path, config.serviceLevel)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.guestJwt}`,
      "X-Api-Token": config.apiToken,
      "X-Service-Level": config.serviceLevel,
    },
  });

  if (!response.ok) {
    throw httpError(response.status, `TxLINE returned ${response.status}`);
  }

  return response.json();
}

function pathWithServiceLevel(path, serviceLevel) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}serviceLevel=${encodeURIComponent(serviceLevel)}`;
}

function hasValue(value) {
  return Boolean(value && !String(value).startsWith("replace_with"));
}

function listFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.fixtures)) return value.fixtures;
  if (Array.isArray(value.matches)) return value.matches;
  return [value];
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = statusCode < 500;
  return error;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}
