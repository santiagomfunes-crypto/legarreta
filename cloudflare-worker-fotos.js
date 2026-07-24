// ============================================================================
// Cloudflare Worker — cache de fotos de Legarreta (baja el egress de Supabase)
// ============================================================================
//
// QUÉ HACE:
//   Sirve las fotos de los autos desde el borde de Cloudflare (ancho de banda
//   ilimitado gratis) en vez de pegarle directo a Supabase. Supabase entrega
//   cada foto UNA vez; después la cachea Cloudflare. El egress de Supabase se
//   desploma → no se revienta el límite de 5 GB/mes del plan gratis.
//
// ESTADO: DESPLEGADO (jul-24-2026).
//   - Worker:     legarreta-fotos
//   - Cuenta CF:  d38d13a13718e9fa0a79d54ecbc3b7f6 (Santiagomfunes1234@icloud.com)
//   - URL activa: https://legarreta-fotos.sfunes-apps.workers.dev/foto/<path>
//   - Origen:     https://pgnmpxqljxrpnvexcygh.supabase.co/storage/v1/object/public/legarreta-fotos/<path>
//   - El catálogo (catalogo.html → mapSupa) ya reescribe las URLs a esta workers.dev.
//
//   NOTA: se usó el subdominio workers.dev (no una ruta en el dominio propio)
//   porque legarretaautomotores.com.ar vive en OTRA cuenta de Cloudflare, no en
//   esta. Si algún día se quiere /foto/* en el dominio propio, hay que deployar
//   el Worker + ruta en la cuenta que tiene la zona.
//
// REDEPLOY (si se edita este archivo): con un API token con Workers Scripts:Edit,
//   PUT https://api.cloudflare.com/client/v4/accounts/<acct>/workers/scripts/legarreta-fotos
//   (multipart: metadata main_module + este archivo como module).
// ============================================================================

const ORIGIN = 'https://pgnmpxqljxrpnvexcygh.supabase.co/storage/v1/object/public/legarreta-fotos';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/foto\//, '');
    if (!path || path === url.pathname) {
      return new Response('Not found', { status: 404 });
    }

    // Trae de Supabase y le pide a Cloudflare que lo cachee 1 año.
    const resp = await fetch(`${ORIGIN}/${path}`, {
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    });

    // Las fotos son inmutables (cada archivo tiene nombre único) → cache larga.
    const headers = new Headers(resp.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(resp.body, { status: resp.status, headers });
  },
};
