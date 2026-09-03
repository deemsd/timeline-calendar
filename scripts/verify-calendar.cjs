const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moment = require('moment');

function load(relativePath, imports) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const module = {exports: {}};
  vm.runInNewContext(code, {module, exports: module.exports, require: id => {
    if (!(id in imports)) throw new Error(`Unexpected import: ${id}`);
    return imports[id];
  }});
  return module.exports;
}

class TFile {
  constructor(filePath) {
    this.path = filePath;
    this.extension = filePath.split('.').pop();
    this.basename = path.basename(filePath, '.md');
  }
}
class TFolder {
  constructor(children) { this.children = children; }
}
const august = new TFile('Journal/2026/2026-08/2026-08-31.md');
const september = new TFile('Journal/2026/2026-09/2026-09-01.md');
const unrelated = new TFile('Journal-Other/2026-09-02.md');
const folders = {
  Journal: new TFolder([new TFolder([august]), new TFolder([september])]),
  'Journal/2026/2026-08': new TFolder([august]),
};
let configured = 'Journal';
const dates = {
  getDailyNoteSettings: () => ({folder: 'Journal/2026/2026-08'}),
  getDateFromFile: file => {
    const date = moment(file.basename, 'YYYY-MM-DD', true);
    return date.isValid() ? date : null;
  },
  getDateUID: date => `day-${date.clone().startOf('day').format()}`,
};
const calendar = load('src/utils/calendarDailyNotes.ts', {
  obsidian: {TFile, TFolder, normalizePath: value => value, Vault: {
    recurseChildren: function recurse(folder, callback) {
      for (const child of folder.children) {
        callback(child);
        if (child instanceof TFolder) recurse(child, callback);
      }
    },
  }},
  'obsidian-daily-notes-interface': dates,
  '@/services/globalService': {default: {
    getState: () => ({pluginSetting: {DailyNoteCreateBaseFolder: configured}}),
    getPlugin: () => ({app: {vault: {getAbstractFileByPath: key => folders[key]}}}),
  }},
});
assert.equal(Object.keys(calendar.getAllDailyNotes()).length, 2);
assert.equal(calendar.isCalendarDailyNote(september), true);
assert.equal(calendar.isCalendarDailyNote(unrelated), false);
configured = '';
assert.equal(Object.keys(calendar.getAllDailyNotes()).length, 1);
assert.equal(calendar.isCalendarDailyNote(september), false);

const parser = load('src/obComponents/parser.ts', {obsidian: {moment}});
for (let index = 0; index < 10; index++) {
  const line = '- [x] Review9:00 📅 2026-09-01 ✅ 2026-09-01';
  assert.equal(parser.lineContainsTime(line), true);
  const event = parser.convertToEvent(parser.parseLine(line), moment('2026-09-01'), index, september.path);
  assert.equal(event.title, 'Review');
  assert.equal(event.start.getHours(), 9);
  assert.equal(event.end.getTime() - event.start.getTime(), 30 * 60 * 1000);
}
assert.equal(parser.convertToEvent(parser.parseLine('  - [ ] Child9:00'), moment('2026-09-01'), 0, september.path), null);
console.log('PASS: cross-month scanning, folder fallback, folder boundary, repeated inline time parsing, duration and nested items.');
