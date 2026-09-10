#!/usr/bin/env node
import { program } from 'commander';
import { watchContent } from './watcher';
import { importOnce } from './importer';
import { validateLocal } from './validator';

program
  .command('watch')
  .description('Watch CONTENT_DATA_PATH for changes and import')
  .action(async () => {
    try {
      await watchContent();
      console.log('Watching for content changes...');
    } catch (error) {
      console.error('Error in watch:', error);
      process.exit(1);
    }
  });

program
  .command('once')
  .description('Import content once (for initial import)')
  .action(async () => {
    try {
      await importOnce();
      console.log('Content imported once.');
    } catch (error) {
      console.error('Error in once:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate current content locally (dry-run)')
  .action(async () => {
    try {
      await validateLocal();
      console.log('Validation complete.');
    } catch (error) {
      console.error('Error in validate:', error);
      process.exit(1);
    }
  });

program.parse();
