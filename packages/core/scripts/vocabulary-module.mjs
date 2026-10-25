// Writes src/vocabulary.js from vocabulary.json, so browsers that lack JSON
// import attributes can load the vocabulary as a plain module.
import fs from 'node:fs'
const here = new URL('..', import.meta.url)
const json = fs.readFileSync(new URL('vocabulary.json', here), 'utf8')
fs.writeFileSync(new URL('src/vocabulary.js', here),
  `// Generated from spec/vocabulary.json by scripts/vocabulary-module.mjs. Do not edit.\nexport default Object.freeze(${json.trim()});\n`)
