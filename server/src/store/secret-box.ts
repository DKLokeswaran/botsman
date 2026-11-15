import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Encrypts provider credentials with AES-256-GCM. The key lives in its own file, which backups leave out.
export class SecretBox {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error("secret key must be 32 bytes");
    this.#key = key;
  }

  static fromFile(file: string): SecretBox {
    if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600, flag: "wx" });
    return new SecretBox(Buffer.from(readFileSync(file, "utf8").trim(), "base64"));
  }

  seal(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
  }

  // A separate key for another purpose, derived from the same secret.
  deriveKey(label: string): Buffer {
    return Buffer.from(hkdfSync("sha256", this.#key, Buffer.alloc(0), label, 32));
  }

  open(sealed: string): string {
    const [version, iv, tag, body] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || body === undefined) throw new Error("unknown sealed format");
    const decipher = createDecipheriv("aes-256-gcm", this.#key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  }
}
