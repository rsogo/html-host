import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// base: "./" で相対パス出力 → Cloudflare Workers 等どこに置いても動く
export default defineConfig({ plugins: [react()], base: "./" });
