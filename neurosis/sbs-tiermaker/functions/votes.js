/**
 * Cloudflare Pages Function: /functions/votes.js
 * Ruta accesible en: /votes (GET y POST)
 *
 * KV namespace vinculado como: VOTES_KV
 * (configurar en Cloudflare Dashboard → Pages → Settings → Functions → KV namespace bindings)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function onRequest(ctx) {
  const { request, env } = ctx;

  // Preflight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const kv = env.VOTES_KV;
  if (!kv) {
    return new Response(
      JSON.stringify({ error: "KV namespace VOTES_KV not bound. Check Cloudflare Pages settings." }),
      { status: 500, headers: CORS }
    );
  }

  // ── GET /votes → devuelve todos los votos ──────────────────────────────────
  if (request.method === "GET") {
    try {
      const list = await kv.list();
      const all = {};
      await Promise.all(
        list.keys.map(async ({ name }) => {
          try {
            const val = await kv.get(name, { type: "json" });
            if (val) all[name] = val;
          } catch (_) {}
        })
      );
      return new Response(JSON.stringify(all), { status: 200, headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }

  // ── POST /votes → guarda el voto de un usuario ────────────────────────────
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { name, vote } = body;

      if (!name || !vote) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: name y vote son obligatorios" }),
          { status: 400, headers: CORS }
        );
      }

      // Clave: nombre normalizado (sin espacios raros, lowercase)
      const key = name.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, "_");
      const data = {
        name: name.trim(),
        tiers: vote.tiers || { S:[], A:[], B:[], C:[], D:[], F:[] },
        pool: vote.pool || [],
        savedAt: new Date().toISOString(),
      };

      await kv.put(key, JSON.stringify(data));
      return new Response(JSON.stringify({ ok: true, key }), { status: 200, headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }

  return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405, headers: CORS });
}
