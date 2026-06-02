// SessionStart hook — when Mentor Mode is ON, re-inject the behavioral contract
// (so the rules survive across sessions) plus a compact learner-profile summary,
// and announce the mode is active. No-op when OFF.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, readProfile } from '../lib/state.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = path.join(__dirname, '..', 'behavioral-contract.md');

function main() {
  const state = readState();
  if (!state.enabled) process.exit(0); // inject nothing when off

  let contract = '';
  try {
    contract = fs.readFileSync(CONTRACT, 'utf8');
  } catch {
    contract = 'MENTOR MODE: do not edit the codebase; guide the user to make every change themselves.';
  }

  const profile = readProfile();
  const topics = profile.topics || {};
  const summary = Object.keys(topics).length
    ? Object.entries(topics)
        .map(
          ([k, v]) =>
            `- ${k}: level=${v.level || '?'} tier=${v.detailTier || 'standard'} declines=${v.declines || 0} explainFurther=${v.explainFurther || 0}`
        )
        .join('\n')
    : '(no topics recorded yet — run the first-run interview if firstRunCompleted is false)';

  const context = [
    '# MENTOR MODE IS ACTIVE',
    '',
    contract,
    '',
    '## Current learner profile (~/.claude/mentor-mode/profile.json)',
    `firstRunCompleted: ${profile.firstRunCompleted === true}`,
    summary,
    '',
    'Read profile.json for full detail, and WRITE it back (via the Write tool — that path is whitelisted) whenever a topic level, tier, decline count, or explain-further count changes.',
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
      },
    })
  );
  process.exit(0);
}

main();
