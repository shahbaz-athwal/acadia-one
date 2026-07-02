import { beforeAll } from "bun:test";

beforeAll(() => {
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && value.startsWith("op://")) {
      throw new Error(
        `${name} is still a 1Password reference. Run tests through \`bun run test\` so it is resolved.`
      );
    }
  }
});
