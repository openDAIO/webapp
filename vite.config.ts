import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

const REVIEWER_ASSETS_MODULE_ID = 'virtual:reviewer-character-assets';
const RESOLVED_REVIEWER_ASSETS_MODULE_ID = `\0${REVIEWER_ASSETS_MODULE_ID}`;

function reviewerCharacterAssetsPlugin(): Plugin {
  const reviewersDir = path.resolve(__dirname, 'public/assets/characters/reviewers');
  const reviewerStatesDir = path.resolve(reviewersDir, 'states');

  const scanReviewerImages = () => {
    if (!fs.existsSync(reviewersDir)) return [];
    return fs
      .readdirSync(reviewersDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  const scanReviewerStates = () => {
    if (!fs.existsSync(reviewerStatesDir)) return [];
    return fs
      .readdirSync(reviewerStatesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.gif'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  return {
    name: 'reviewer-character-assets',
    configureServer(server) {
      const refreshReviewerModule = (file: string) => {
        const isReviewerImage = path.dirname(file) === reviewersDir && file.toLowerCase().endsWith('.png');
        const isReviewerState = path.dirname(file) === reviewerStatesDir && file.toLowerCase().endsWith('.gif');
        if (!isReviewerImage && !isReviewerState) return;

        const mod = server.moduleGraph.getModuleById(RESOLVED_REVIEWER_ASSETS_MODULE_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };

      server.watcher.add(reviewersDir);
      server.watcher.add(reviewerStatesDir);
      server.watcher.on('add', refreshReviewerModule);
      server.watcher.on('unlink', refreshReviewerModule);
    },
    resolveId(id) {
      if (id === REVIEWER_ASSETS_MODULE_ID) return RESOLVED_REVIEWER_ASSETS_MODULE_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_REVIEWER_ASSETS_MODULE_ID) return null;
      return [
        `export const reviewerImageFiles = ${JSON.stringify(scanReviewerImages())};`,
        `export const reviewerStateFiles = ${JSON.stringify(scanReviewerStates())};`,
      ].join('\n');
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [reviewerCharacterAssetsPlugin(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
