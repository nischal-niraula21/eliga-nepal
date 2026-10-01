import { createApiConnection } from "./connection.js";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const { api, backend } = createApiConnection(API_URL, {
  getToken(config) {
    const url = String(config.url || "");
    const wantsAdminToken = config.useAdminToken === true || url.startsWith("/admin");
    return localStorage.getItem(wantsAdminToken ? "eliga_admin_token" : "eliga_player_token");
  }
});

export { backend };

export function fileUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}

export default api;
