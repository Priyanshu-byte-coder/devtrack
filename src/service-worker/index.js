// Only static resources are cached. Remove caches and queued requests from older releases.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              !name.startsWith("devtrack-static-v2") &&
              !name.startsWith("devtrack-fonts-v2") &&
              !name.startsWith("workbox-precache-v2")
          )
          .map((name) => caches.delete(name))
      );
      await Promise.all(
        ["workbox-background-sync", "keyval-store"].map(
          (database) =>
            new Promise((resolve) => {
              const request = indexedDB.deleteDatabase(database);
              request.onsuccess = request.onerror = request.onblocked = resolve;
            })
        )
      );
    })()
  );
});
