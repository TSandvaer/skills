// PreToolUse hook — the hard backstop for Mentor Mode.
// While Mentor Mode is ON it blocks codebase mutations so the LEARNER makes
// every edit. When OFF it is a no-op (allows everything).
import { readState, isInsideStateDir } from '../lib/state.mjs';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// Shell commands that change the codebase / project state. Read-only inspection,
// builds, tests and running the app are deliberately NOT here — the learner needs
// them to verify their own manual edits.
const MUTATING_BASH = [
  // file removal / move / create / truncate
  /\b(rm|rmdir|unlink|shred|truncate|mv|cp|mkdir|touch)\b/,
  // in-place stream editors (sed -i, perl -i)
  /\b(sed|perl)\s+(?:-[^\s]*\s+)*-i/,
  // redirection that writes to a real file (skips 2>&1 and null devices)
  /(^|[^0-9&\s])\s*>>?\s*(?!&)(?!\/dev\/null)(?!nul\b)(?!\$null\b)[^\s>|&]/,
  // git working-tree / history mutations (read-only git is allowed)
  /\bgit\s+(?:-[^\s]+\s+)*(commit|push|add|reset|rebase|merge|checkout|switch|restore|clean|stash|cherry-pick|apply|am|revert|rm|mv|tag|branch)\b/,
  // dependency mutations
  /\b(npm|pnpm)\s+(install|i|ci|add|remove|uninstall)\b/,
  /\byarn\s+(add|remove|install|up|upgrade)\b/,
  /\bdotnet\s+(add|remove)\b/,
  /\bnuget\s+(install|restore|add)\b/,
  // PowerShell mutating cmdlets
  /\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|Rename-Item|Clear-Content|Set-Item|Set-ItemProperty)\b/i,
];

const GUIDANCE =
  'Mentor Mode is ON: do not modify the codebase or run mutating commands. ' +
  'Instead, point the user to the exact file and lines, explain WHAT to change and WHY, ' +
  'hand a paste-ready snippet, then let the user make the edit themselves and confirm ' +
  'their understanding. Read-only inspection, builds and tests are allowed; writes to ' +
  '~/.claude/mentor-mode/ (your profile/state) are allowed. Run /mentor-mode off to disable.';

function deny(detail) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${GUIDANCE} (${detail})`,
      },
    })
  );
  process.exit(0);
}

async function main() {
  const state = readState();
  if (!state.enabled) process.exit(0); // mode OFF -> allow everything

  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let input = {};
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    process.exit(0); // can't parse -> don't break the session
  }

  const tool = input.tool_name;
  const ti = input.tool_input || {};

  if (EDIT_TOOLS.has(tool)) {
    const target = ti.file_path || ti.notebook_path || ti.path;
    if (isInsideStateDir(target)) process.exit(0); // allow profile/state writes
    deny(`Blocked ${tool} on ${target || 'a project file'}.`);
  }

  if (tool === 'Bash') {
    const cmd = String(ti.command || '');
    for (const re of MUTATING_BASH) {
      if (re.test(cmd)) deny('Blocked a mutating shell command.');
    }
  }

  process.exit(0); // allow everything else
}

main();
