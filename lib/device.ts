export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const key = "kehoes_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
