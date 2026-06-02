// Idempotently register the Mentor Mode hooks into ~/.claude/settings.json.
// Backs the file up first, computes absolute script paths for THIS machine, and
// replaces any stale mentor-mode entries so the paths stay current.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

const sessionStartScript = path.join(__dirname, 'hooks', 'session-start.mjs');
const preToolUseScript = path.join(__dirname, 'hooks', 'pre-tool-use.mjs');

const MARK = 'mentor-mode'; // our entries are identified by this substring in the command

function load() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch {
    return {};
  }
}

function isOurs(group) {
  return (
    Array.isArray(group?.hooks) &&
    group.hooks.some((h) => typeof h.command === 'string' && h.command.includes(MARK))
  );
}

function ensureEvent(hooks, event, matcher, command) {
  hooks[event] = (hooks[event] || []).filter((g) => !isOurs(g)); // drop stale ours
  hooks[event].push({
    matcher,
    hooks: [{ type: 'command', command, timeout: 10 }],
  });
}

function main() {
  const settings = load();

  if (fs.existsSync(SETTINGS)) {
    const backup = `${SETTINGS}.mentor-backup-${Date.now()}`;
    fs.copyFileSync(SETTINGS, backup);
    console.log(`Backed up settings.json -> ${path.basename(backup)}`);
  } else {
    fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  }

  settings.hooks = settings.hooks || {};
  ensureEvent(
    settings.hooks,
    'SessionStart',
    'startup|resume|clear|compact',
    `node "${sessionStartScript}"`
  );
  ensureEvent(
    settings.hooks,
    'PreToolUse',
    'Edit|Write|MultiEdit|NotebookEdit|Bash',
    `node "${preToolUseScript}"`
  );

  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  console.log(`Mentor Mode hooks registered in ${SETTINGS}`);
}

main();
