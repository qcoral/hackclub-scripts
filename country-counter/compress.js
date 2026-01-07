import fs from "fs";

function compressInput() {
  const inputFile = "input.txt";
  const outputFile = "input_compressed.txt";

  // Read the input file
  const content = fs.readFileSync(inputFile, "utf-8");

  // Split into lines and filter out empty lines
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  // Use a Set to get unique entries, preserving order, case-insensitive
  const uniqueLines = [];
  const seen = new Set();
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueLines.push(line);
    }
  }

  // Write to output file
  fs.writeFileSync(outputFile, uniqueLines.join("\n") + "\n");

  console.log(
    `Compressed ${lines.length} lines to ${uniqueLines.length} unique entries in ${outputFile}`
  );
}

compressInput();
