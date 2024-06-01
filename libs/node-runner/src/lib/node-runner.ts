import { register } from 'module';

register('./node-loader.js', import.meta.url);

const dynamicImport = new Function('specifier', 'return import(specifier)');

dynamicImport(process.env['NX_FILE_TO_RUN']);
