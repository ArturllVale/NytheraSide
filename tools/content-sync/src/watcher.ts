import chokidar from 'chokidar';
import debounce from 'lodash.debounce';
import { importContent } from './importer';
import path from 'path';

const CONTENT_DATA_PATH = process.env.CONTENT_DATA_PATH || './www/data';

export async function watchContent() {
  const watcher = chokidar.watch('**/*.json', {
    cwd: CONTENT_DATA_PATH,
    awaitWriteFinish: {
      stabilityThreshold: 400,
      pollInterval: 100,
    },
    ignoreInitial: true,
  });

  // Debounce handler: 2000ms as required by plan.md
  const debouncedImport = debounce(async (filePath: string) => {
    console.log(`Change detected: ${filePath}`);
    try {
      await importContent([path.join(CONTENT_DATA_PATH, filePath)]);
      console.log(`Imported: ${filePath}`);
    } catch (error) {
      console.error(`Failed to import ${filePath}:`, error);
    }
  }, 2000);

  watcher.on('add', (filePath) => debouncedImport(filePath));
  watcher.on('change', (filePath) => debouncedImport(filePath));

  watcher.on('ready', () => {
    console.log('Watcher ready for changes.');
  });
}
