export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.error("❌ CRITICAL ERROR: VITE_API_BASE_URL is not defined in environment variables.");
}