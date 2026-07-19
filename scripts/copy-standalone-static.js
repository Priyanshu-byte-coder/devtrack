const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;

  try {
    fs.mkdirSync(dest, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory: ${dest}`);
    console.error(error.message);
    return;
  }

  let entries;

  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (error) {
    console.error(`Failed to read directory: ${src}`);
    console.error(error.message);
    return;
  }

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (error) {
        console.error(`Failed to copy ${srcPath} to ${destPath}`);
        console.error(error.message);
      }
    }
  }
}
const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');

if (fs.existsSync(standaloneDir)) {
  console.log('Copying static files to standalone directory...');
  copyDir(
    path.join(__dirname, '..', 'public'),
    path.join(standaloneDir, 'public')
  );
  copyDir(
    path.join(__dirname, '..', '.next', 'static'),
    path.join(standaloneDir, '.next', 'static')
  );
  console.log('Done.');
}
