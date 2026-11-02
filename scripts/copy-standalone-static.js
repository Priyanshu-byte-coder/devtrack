const fs = require('node:fs');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
const standalone = path.join(project, '.next', 'standalone');
if (!fs.existsSync(standalone)) throw new Error('Standalone output is missing; build with output: standalone.');
console.log('Copying static files to standalone directory...');
fs.cpSync(path.join(project, 'public'), path.join(standalone, 'public'), { recursive: true, force: true });
fs.cpSync(path.join(project, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true, force: true });
console.log('Done.');
