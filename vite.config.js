import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SheetJS ships its own ESM; nothing special needed. pdfjs-dist worker is
// imported with `?url` in src/lib/parse.js so Vite bundles it correctly.
export default defineConfig({
  plugins: [react()],
});
