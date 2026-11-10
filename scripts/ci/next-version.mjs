#!/usr/bin/env node
// Prints the version a release button run should publish.
//   next-version.mjs <current> <patch|minor|major> [exact]
// With an exact version, checks it and prints it; otherwise raises the chosen part of
// <current>. Raising a pre-release finishes it, as npm does: 0.5.0-beta.1 + patch = 0.5.0.
// Fails unless the result is newer than <current>.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

const parse = (version) => {
  const match = SEMVER.exec(version)
  if (!match) throw new Error(`"${version}" is not a version like 1.2.3 or 1.2.3-beta.1`)
  const [, major, minor, patch, pre] = match
  return { major: +major, minor: +minor, patch: +patch, pre: pre ? pre.split('.') : [] }
}

const comparePre = (a, b) => {
  // A release sorts after its own pre-releases: 1.0.0-beta < 1.0.0
  if (!a.length || !b.length) return b.length - a.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1
    if (b[i] === undefined) return 1
    const [numA, numB] = [/^\d+$/.test(a[i]), /^\d+$/.test(b[i])]
    if (numA && numB && +a[i] !== +b[i]) return +a[i] - +b[i]
    if (numA !== numB) return numA ? -1 : 1
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

const compare = (a, b) =>
  a.major - b.major || a.minor - b.minor || a.patch - b.patch || comparePre(a.pre, b.pre)

const bump = ({ major, minor, patch, pre }, part) => {
  const isPre = pre.length > 0
  if (part === 'major') return isPre && !minor && !patch ? `${major}.0.0` : `${major + 1}.0.0`
  if (part === 'minor') return isPre && !patch ? `${major}.${minor}.0` : `${major}.${minor + 1}.0`
  if (part === 'patch')
    return isPre ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`
  throw new Error(`bump must be patch, minor or major, not "${part}"`)
}

const [current, part, exact] = process.argv.slice(2)
try {
  if (!current || !part)
    throw new Error('usage: next-version.mjs <current> <patch|minor|major> [exact]')
  const from = parse(current)
  const next = exact?.trim() ? exact.trim().replace(/^v/, '') : bump(from, part)
  if (compare(parse(next), from) <= 0) {
    throw new Error(`${next} is not newer than the current version ${current}`)
  }
  console.log(next)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
