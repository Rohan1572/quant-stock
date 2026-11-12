export function singleFlight<K, V>(
  requests: Map<K, Promise<V>>,
  key: K,
  createRequest: () => Promise<V>,
): Promise<V> {
  const pending = requests.get(key);
  if (pending !== undefined) return pending;

  const request = Promise.resolve()
    .then(createRequest)
    .finally(() => {
      if (requests.get(key) === request) {
        requests.delete(key);
      }
    });
  requests.set(key, request);
  return request;
}
