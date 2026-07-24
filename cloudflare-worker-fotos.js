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
//   Ruta pública:  https://legarretaautomotores.com.ar/foto/<path>
//   Origen real:   https://pgnmpxqljxrpnvexcygh.supabase.co/storage/v1/object/public/legarreta-fotos/<path>
//
// CÓMO INSTALARLO (dashboard, ~5 min, sin API token):
//   1. Cloudflare → Workers & Pages → Create → Create Worker → nombre: "legarreta-fotos"
//   2. Deploy → Edit code → borrar el ejemplo y pegar TODO este archivo → Deploy
//   3. En el Worker → Settings → Domains & Routes → Add → Route:
//         Zone:  legarretaautomotores.com.ar
//         Route: legarretaautomotores.com.ar/foto/*
//   4. Avisar a Claude Code: "el worker está en /foto/*" → se reescriben las
//      URLs de las fotos en la web para que usen /foto/ (hasta ese momento NO
//      tocar la web, si no las imágenes apuntan a una ruta que todavía no existe).
//
// PROBAR (después de instalar): abrir en el navegador
//   https://legarretaautomotores.com.ar/foto/<id>/<archivo>.jpg
//   (tomar un path real de una foto que hoy funcione en el catálogo)
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
