/**
 * Zeeba background remover.
 *
 * POST /remove-background
 *   body:    the photo's bytes (JPEG/PNG/WebP)
 *   headers: Authorization: Bearer <Supabase access token>
 *            apikey: <Supabase anon key>
 *   200:     image/png - the photo with everything but the subject transparent
 *
 * The cutout is made by Cloudflare Images (`segment: "foreground"`), so this
 * Worker is only a gatekeeper: it checks the caller is signed in to Zeeba,
 * then streams the upload through the Images binding and back. It stores
 * nothing.
 *
 * The web app's client is src/utils/removeBackground.web.ts.
 */

// The app downsizes photos to ~2048px before uploading (well under 1 MB), so
// anything this large is not coming from the app.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Cloudflare Images error codes worth telling apart for the user.
const IMAGES_NOT_AN_IMAGE = 9412;
const IMAGES_QUOTA_EXCEEDED = 9422;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const json = (status, body) => Response.json(body, { status, headers: cors });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/') {
      return json(200, { service: 'zeeba-background-remover', ok: true });
    }
    if (request.method !== 'POST' || pathname !== '/remove-background') {
      return json(404, { error: 'not_found' });
    }

    if (!isConfigured(env)) {
      return json(500, {
        error: 'not_configured',
        message: 'Set SUPABASE_URL in wrangler.toml to your Supabase project URL, then deploy again.',
      });
    }

    // Browsers always send Origin on a cross-site POST. One that isn't on the
    // list is another website trying to use this service. Requests with no
    // Origin (curl, a native app) are judged on their sign-in token alone.
    const origin = request.headers.get('Origin');
    if (origin && !allowedOrigins(env).includes(origin)) {
      return json(403, { error: 'origin_not_allowed' });
    }

    if (!(await isSignedIn(request, env))) {
      return json(401, { error: 'not_signed_in' });
    }

    const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
    if (!request.body || declaredLength > MAX_UPLOAD_BYTES) {
      return json(declaredLength > MAX_UPLOAD_BYTES ? 413 : 400, {
        error: declaredLength > MAX_UPLOAD_BYTES ? 'photo_too_large' : 'missing_photo',
      });
    }

    try {
      const result = await env.IMAGES.input(request.body)
        .transform({ segment: 'foreground' })
        // PNG keeps the transparency the segmentation just created.
        .output({ format: 'image/png' });

      return new Response(result.image(), {
        headers: { ...cors, 'Content-Type': result.contentType(), 'Cache-Control': 'no-store' },
      });
    } catch (err) {
      if (err?.code === IMAGES_QUOTA_EXCEEDED) {
        return json(429, { error: 'monthly_limit_reached' });
      }
      if (err?.code === IMAGES_NOT_AN_IMAGE) {
        return json(415, { error: 'not_an_image' });
      }
      console.error('Background removal failed', err?.code, err?.message);
      return json(502, { error: 'removal_failed', code: err?.code ?? null });
    }
  },
};

function isConfigured(env) {
  return typeof env.SUPABASE_URL === 'string' && /^https?:\/\//.test(env.SUPABASE_URL) && !env.SUPABASE_URL.includes('YOUR-PROJECT-REF');
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

/**
 * CORS headers for every response. Access-Control-Allow-Origin is only sent
 * for an origin on the list, so a browser on any other site can't read the
 * response even if it gets one.
 */
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

/**
 * Asks Supabase whether the caller's access token is a live session for this
 * project. The project is pinned by SUPABASE_URL, so a token from someone
 * else's Supabase project is rejected; the anon key the caller forwards is
 * the public one already shipped in the app.
 */
async function isSignedIn(request, env) {
  const authorization = request.headers.get('Authorization') ?? '';
  const apikey = request.headers.get('apikey') ?? '';
  if (!authorization.startsWith('Bearer ') || !apikey) return false;

  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey },
    });
    return response.ok;
  } catch {
    return false;
  }
}
