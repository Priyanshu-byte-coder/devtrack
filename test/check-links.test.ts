import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

function getFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        results = results.concat(getFiles(filePath));
      }
    } else {
      if (
        file.endsWith(".tsx") ||
        file.endsWith(".ts") ||
        file.endsWith(".js") ||
        file.endsWith(".jsx")
      ) {
        results.push(filePath);
      }
    }
  });
  return results;
}

describe("Security Link Audit", () => {
  it("verifies all target='_blank' links have noopener and noreferrer attributes", () => {
    const srcDir = path.resolve(__dirname, "../src");
    const files = getFiles(srcDir);
    const failures: string[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf8");
      let index = 0;
      while (true) {
        const aIndex = content.indexOf("<a", index);
        if (aIndex === -1) break;

        const closeIndex = content.indexOf(">", aIndex);
        if (closeIndex === -1) {
          index = aIndex + 2;
          continue;
        }

        const tagContent = content.substring(aIndex, closeIndex + 1);
        const hasTargetBlank = /target\s*=\s*["']_blank["']/i.test(tagContent);

        if (hasTargetBlank) {
          const hasNoopener = /noopener/i.test(tagContent);
          const hasNoreferrer = /noreferrer/i.test(tagContent);

          if (!hasNoopener || !hasNoreferrer) {
            const linesBefore = content.substring(0, aIndex).split("\n");
            const relativePath = path.relative(path.resolve(__dirname, ".."), file);
            failures.push(`${relativePath}:L${linesBefore.length} - ${tagContent.replace(/\s+/g, " ")}`);
          }
        }

        index = closeIndex + 1;
      }
    });

    expect(failures, `Found links missing 'noopener' and/or 'noreferrer':\n${failures.join("\n")}`).toEqual([]);
  });
});
