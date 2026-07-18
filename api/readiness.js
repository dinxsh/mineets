import { readinessPayload, sendJson } from "./_txline.js";

export default function handler(_request, response) {
  sendJson(response, 200, readinessPayload());
}
