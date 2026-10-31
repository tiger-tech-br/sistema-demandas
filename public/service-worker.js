// A conta depende de uma sessao online. Nunca armazene respostas privadas da API.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((nomes) => Promise.all(
            nomes.filter((nome) => nome.startsWith("sistema-demandas")).map((nome) => caches.delete(nome))
        )).then(() => self.clients.claim())
    );
});
