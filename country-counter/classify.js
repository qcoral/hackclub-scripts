import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function normalizeCountry(country) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: `What is the ISO 3166-1 alpha-3 country code for "${country}"? Respond with only the 3-letter code. If the country is not recognized, respond with "NOT_A_COUNTRY".`,
        },
      ],
      max_tokens: 10,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Error normalizing "${country}":`, error.message);
    return "ERROR";
  }
}

async function main() {
  const inputFile = "input_compressed.txt";
  const outputFile = "out.txt";

  // Clear out.txt if it exists
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  const countries = fs
    .readFileSync(inputFile, "utf-8")
    .split("\n")
    .filter((line) => line.trim());

  for (const country of countries) {
    const isoCode = await normalizeCountry(country);
    fs.appendFileSync(outputFile, `${isoCode}\n`);
    console.log(`Processed: ${country} -> ${isoCode}`);
    // Add a small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("Done processing all countries.");
}

main().catch(console.error);
