const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'states', 'example');
const t0Path = path.join(dir, 't0.json');

const t0Data = JSON.parse(fs.readFileSync(t0Path, 'utf8'));

// Build mapping
const map = {};
Object.keys(t0Data).forEach(key => {
  const [actualId, context] = key.split('@');
  if (context) {
    map[actualId] = '@' + context;
  }
});

// Update all other JSON files
fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith('.json') || file === 't0.json') return;
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const newData = {};
  
  Object.keys(data).forEach(key => {
    const actualId = key.split('@')[0];
    const suffix = map[actualId] || '';
    const oldSuffix = key.includes('@') ? '@' + key.split('@')[1] : '';
    // Use new suffix if available, otherwise fallback to old suffix
    newData[actualId + (map[actualId] ? suffix : oldSuffix)] = data[key];
  });
  
  fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
  console.log(`Updated ${file}`);
});
console.log('State Identifiers Sync Done.');
