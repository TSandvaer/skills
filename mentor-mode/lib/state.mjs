import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// State + learner profile live OUTSIDE the skill folder, so they are per-user
// and never travel inside a shared zip of the skill.
export const STATE_DIR = path.join(os.homedir(), '.claude', 'mentor-mode');
export const STATE_FILE = path.join(STATE_DIR, 'state.json');
export const PROFILE_FILE = path.join(STATE_DIR, 'profile.json');

export function ensureDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function readState() {
  return readJson(STATE_FILE, { enabled: false, version: 1 });
}

export function writeState(state) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function readProfile() {
  return readJson(PROFILE_FILE, { firstRunCompleted: false, topics: {} });
}

export function writeProfile(profile) {
  ensureDir();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

// True when `p` resolves to the state dir or anything inside it. Used by the
// PreToolUse hook to WHITELIST profile/state writes while blocking project edits.
export function isInsideStateDir(p) {
  if (!p) return false;
  try {
    const resolved = path.resolve(p);
    const dir = path.resolve(STATE_DIR);
    return resolved === dir || resolved.startsWith(dir + path.sep);
  } catch {
    return false;
  }
}
