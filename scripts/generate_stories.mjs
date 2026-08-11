import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve("../../outputs/Greek_Mythology_Tarot_78_Cards_Art_Director_Edition.md");
const outputPath = resolve("app/stories.ts");
const markdown = readFileSync(sourcePath, "utf8");
const sectionStart = markdown.indexOf("## 二、大阿卡纳");
const sectionEnd = markdown.indexOf("## 四、", sectionStart);
const cardSection = markdown.slice(sectionStart, sectionEnd);
const headingPattern = /^(#{3,4})\s+(.+——.+)$/gm;
const matches = [...cardSection.matchAll(headingPattern)];
const stories = matches.map((match, index) => {
  const bodyStart = match.index + match[0].length;
  const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : cardSection.length;
  return cardSection.slice(bodyStart, bodyEnd).split(/\n\s*\n/).map((part) => part.trim()).find((part) => part && !part.startsWith("#")) || "";
});

if (stories.length !== 78) {
  throw new Error(`Expected 78 stories, found ${stories.length}`);
}

writeFileSync(outputPath, `// Generated from the Art Director Edition.\nexport const tarotStories = ${JSON.stringify(stories, null, 2)} as const;\n`);
console.log(`Generated ${stories.length} Greek mythology stories.`);
