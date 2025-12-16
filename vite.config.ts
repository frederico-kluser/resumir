import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Plugin to copy manifest.json and assets to dist directory
const copyAssets = () => {
  return {
    name: 'copy-assets',
    closeBundle: () => {
      const distDir = resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
      }

      // Copy Manifest
      if (fs.existsSync('manifest.json')) {
        fs.copyFileSync('manifest.json', 'dist/manifest.json');
      }

      // Copy assets folder (icons)
      const assetsDir = resolve(__dirname, 'assets');
      const distAssetsDir = resolve(distDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        if (!fs.existsSync(distAssetsDir)) {
          fs.mkdirSync(distAssetsDir, { recursive: true });
        }
        const assetFiles = fs.readdirSync(assetsDir);
        for (const file of assetFiles) {
          fs.copyFileSync(resolve(assetsDir, file), resolve(distAssetsDir, file));
        }
        console.log('Copied assets folder to dist/assets/');
      }
    }
  };
};

export default defineConfig({
  plugins: [react(), copyAssets()],
  define: {
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'background.ts'),
        content: resolve(__dirname, 'content.ts'),
        deepseekContent: resolve(__dirname, 'deepseekContent.ts'),
        chatgptContent: resolve(__dirname, 'chatgptContent.ts'),
        geminiContent: resolve(__dirname, 'geminiContent.ts'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});