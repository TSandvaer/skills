// Flip Mentor Mode on/off (or print current state). Writes via Node's fs, so it
// works even while Mentor Mode is ON (the PreToolUse hook inspects shell command
// text and Edit/Write tool calls — a plain `node toggle.mjs off` matches neither).
import { readState, writeState } from './lib/state.mjs';

const arg = (process.argv[2] || '').toLowerCase();
const state = readState();

if (arg === 'on') {
  state.enabled = true;
} else if (arg === 'off') {
  state.enabled = false;
} else {
  console.log(JSON.stringify(state));
  process.exit(0);
}

writeState(state);
console.log(`Mentor Mode is now ${state.enabled ? 'ON' : 'OFF'}.`);
