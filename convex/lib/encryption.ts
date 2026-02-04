"use node";

import crypto from "node:crypto";

/**
 * Encrypts user credentials using AES-256-GCM with the provided token as the encryption key.
 *
 * @param username - The username to encrypt
 * @param password - The password to encrypt
 * @param token - The 32-byte hex token used as the encryption key
 * @returns Encrypted string in format: ${iv}:${authTag}:${encryptedData} (hex encoded)
 * @throws Error if encryption fails
 */
export function encryptCredentials(
  username: string,
  password: string,
  token: string
): string {
  try {
    // Create the plaintext JSON object
    const plaintext = JSON.stringify({ username, password });

    // Convert the hex token to a Buffer (32 bytes for AES-256)
    const key = Buffer.from(token, "hex");

    // Generate a random 16-byte IV
    const iv = crypto.randomBytes(16);

    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encryptedData (all hex encoded)
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Decrypts user credentials using AES-256-GCM with the provided token as the decryption key.
 *
 * @param encryptedString - The encrypted string in format: ${iv}:${authTag}:${encryptedData}
 * @param token - The 32-byte hex token used as the decryption key
 * @returns Object containing the decrypted username and password
 * @throws Error if decryption fails (invalid token or tampered data)
 */
export function decryptCredentials(
  encryptedString: string,
  token: string
): { username: string; password: string } {
  try {
    // Split the encrypted string to extract components
    const parts = encryptedString.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted string format");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    // Convert hex strings back to Buffers
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = Buffer.from(token, "hex");

    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);

    // Set the authentication tag
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // Parse the JSON and return
    const credentials = JSON.parse(decrypted) as {
      username: string;
      password: string;
    };

    return credentials;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
