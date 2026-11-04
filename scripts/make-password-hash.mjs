import { scryptSync, randomBytes } from "node:crypto";
const password = process.argv[2];
if (!password || password.length < 14) {
  console.error("Usage: node scripts/make-password-hash.mjs \"a-long-unique-password\" (minimum 14 characters)");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`scrypt$${salt}$${hash}`);