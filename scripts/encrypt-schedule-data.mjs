import { createCipheriv, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputArgument, outputArgument = "data/schedule.enc.json"] = process.argv;
if (!inputArgument) {
  console.error("Usage: node scripts/encrypt-schedule-data.mjs <private-schedule.json> [output]");
  process.exitCode = 1;
} else {
  const encodedKey = process.env.SCHEDULE_DATA_KEY?.trim();
  const key = encodedKey ? Buffer.from(encodedKey, "base64url") : null;
  if (!key || key.length !== 32) {
    console.error("SCHEDULE_DATA_KEY must be a base64url-encoded 32-byte key.");
    process.exitCode = 1;
  } else {
    const inputPath = path.resolve(inputArgument);
    const outputPath = path.resolve(outputArgument);
    if (inputPath === outputPath) {
      throw new Error("Input and output paths must differ.");
    }

    const plaintext = await fs.readFile(inputPath);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from("117.ee/schedule/v1", "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const payload = {
      version: 1,
      algorithm: "aes-256-gcm",
      iv: Buffer.from(iv).toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(payload)}\n`, { encoding: "utf8", mode: 0o600 });
    console.log(`Encrypted schedule written to ${outputPath}`);
  }
}
