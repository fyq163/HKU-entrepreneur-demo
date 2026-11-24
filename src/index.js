const COOKIE_NAME = "__Host-confession-session";
const TOKEN_PATTERN = /^[a-f0-9]{32}$/i;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function getSessionToken(request) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name !== COOKIE_NAME) continue;
    const value = valueParts.join("=");
    return TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function publicRecord(row) {
  return {
    name: row.name,
    message: row.message,
    created_at: row.created_at,
  };
}

function privateRecord(row) {
  return {
    name: row.name,
    email: row.email,
    message: row.message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Please submit a valid message form." };
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  if (!name || name.length > MAX_NAME_LENGTH) {
    return { error: `Name must be between 1 and ${MAX_NAME_LENGTH} characters.` };
  }
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    return { error: "Please enter a valid email address." };
  }
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return {
      error: `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }
  if (payload.consent !== true) {
    return { error: "Please confirm that your name and message may be shown publicly." };
  }

  return { value: { name, email, message } };
}

async function handleApi(request, env, url) {
  if (!env.CONFESSIONS_DB) {
    return jsonResponse(
      { error: "The message board is not configured with a D1 database yet." },
      503,
    );
  }

  if (url.pathname === "/api/confessions" && request.method === "GET") {
    const result = await env.CONFESSIONS_DB
      .prepare(
        "SELECT name, message, created_at FROM confessions ORDER BY created_at DESC LIMIT 100",
      )
      .all();
    return jsonResponse({ confessions: (result.results || []).map(publicRecord) });
  }

  if (url.pathname === "/api/confessions/mine" && request.method === "GET") {
    const token = getSessionToken(request);
    if (!token) return jsonResponse({ confession: null });

    const sessionHash = await hashToken(token);
    const row = await env.CONFESSIONS_DB
      .prepare(
        "SELECT name, email, message, created_at, updated_at FROM confessions WHERE session_hash = ?",
      )
      .bind(sessionHash)
      .first();

    return jsonResponse({ confession: row ? privateRecord(row) : null });
  }

  if (url.pathname === "/api/confessions" && request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return jsonResponse({ error: "Cross-origin submissions are not allowed." }, 403);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 12_000) {
      return jsonResponse({ error: "The submission is too large." }, 413);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Please submit valid JSON." }, 400);
    }

    const validation = validatePayload(payload);
    if (validation.error) return jsonResponse({ error: validation.error }, 400);

    let token = getSessionToken(request);
    const isNewSession = !token;
    if (!token) token = crypto.randomUUID().replaceAll("-", "");

    const sessionHash = await hashToken(token);
    const now = new Date().toISOString();
    const { name, email, message } = validation.value;

    await env.CONFESSIONS_DB
      .prepare(
        `INSERT INTO confessions (session_hash, name, email, message, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_hash) DO UPDATE SET
           name = excluded.name,
           email = excluded.email,
           message = excluded.message,
           updated_at = excluded.updated_at`,
      )
      .bind(sessionHash, name, email, message, now, now)
      .run();

    const row = await env.CONFESSIONS_DB
      .prepare(
        "SELECT name, email, message, created_at, updated_at FROM confessions WHERE session_hash = ?",
      )
      .bind(sessionHash)
      .first();

    const headers = isNewSession
      ? {
          "set-cookie": `${COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax`,
        }
      : {};

    return jsonResponse({ confession: privateRecord(row) }, 200, headers);
  }

  if (url.pathname === "/api/confessions" || url.pathname === "/api/confessions/mine") {
    return jsonResponse({ error: "Method not allowed." }, 405, { allow: "GET, POST" });
  }

  return jsonResponse({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error("Message Board API error:", error);
        return jsonResponse(
          { error: "The message board is temporarily unavailable. Please try again later." },
          503,
        );
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found.", { status: 404 });
  },
};
