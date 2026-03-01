const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist/cloudhw-fe/browser');

// Inject environment variables into env.js at startup
const envSamplePath = path.join(DIST_DIR, 'assets/env.sample.js');
const envJsPath = path.join(DIST_DIR, 'assets/env.js');

if (fs.existsSync(envSamplePath)) {
  let content = fs.readFileSync(envSamplePath, 'utf8');
  content = content.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
  fs.writeFileSync(envJsPath, content, 'utf8');
  console.log('env.js generated from env.sample.js');
}

app.use(express.static(DIST_DIR));

app.get('/**', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
