import fs from "node:fs/promises";
import path from "node:path";
import { activateApiToken, handleApiError, readJsonBody, readinessPayload, sendJson } from "./_txline.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: { message: "Method not allowed", statusCode: 405 } });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const token = await activateApiToken(body);
    const tokenStored = await storeLocalApiToken(token);
    sendJson(response, 200, {
      activated: true,
      tokenStored,
      readiness: readinessPayload(),
    });
  } catch (error) {
    handleApiError(response, error);
  }
}

async function storeLocalApiToken(token) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return false;

  const envPath = path.join(process.cwd(), ".env.local");
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  const nextLine = `TXLINE_API_TOKEN=${token}`;
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("TXLINE_API_TOKEN="));

  lines.push(nextLine);
  await fs.writeFile(envPath, `${lines.join("\n")}\n`, "utf8");
  return true;
}
