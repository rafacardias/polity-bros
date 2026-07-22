// Bump a cada mudança de estratégia/versão: o handler 'activate' apaga todo
// cache com nome != CACHE_NAME, purgando o app-shell velho no próximo load.
const CACHE_NAME = 'polity-games-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// NETWORK-FIRST para o app-shell (mesma origem, GET). Antes era
// stale-while-revalidate, que servia o cache VELHO primeiro — depois de um
// deploy o jogador ficava preso na versão antiga até um 2º carregamento
// (bug real reportado). Agora: online → sempre a versão publicada mais nova
// (e atualiza o cache de reserva); offline → cai no cache. Sprites de arte
// (/assets/sprites/*.png) NÃO têm hash no nome (mesmo arquivo muda de
// conteúdo entre versões), então também precisam de rede-primeiro — por isso
// a regra vale para TUDO da origem, não só o HTML.
//
// Chamadas ao Supabase (auth/scores) são cross-origin e nem entram aqui —
// vão sempre direto pra rede (score não pode servir dado velho de cache).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        // sem rede: usa a última cópia em cache, se houver
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error('offline e sem cache para ' + request.url);
      }
    }),
  );
});
