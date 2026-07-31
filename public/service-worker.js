const CACHE_NAME = "sistema-demandas-v9";

const arquivos = [
    "/",
    "/index.html",
    "/css/style.css",
    "/js/script.js",
    "/manifest.json",
    "/icons/icon-192.png",
    "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME).then((cache) => {

            return cache.addAll(arquivos);

        })

    );

});

self.addEventListener("activate", (event) => {

    event.waitUntil(

        caches.keys().then((keys) => {

            return Promise.all(

                keys.map((key) => {

                    if (key !== CACHE_NAME) {

                        return caches.delete(key);

                    }

                })

            );

        })

    );

});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((respostaCache) => {
            return respostaCache || fetch(event.request);
        })
    );
});
