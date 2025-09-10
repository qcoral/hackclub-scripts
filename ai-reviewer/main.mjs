/*
This file uses gpt-5-mini to filter through journals that are missing either:

- the build phase entirely
- images of the build phase

results get stored in results.json

150 journals took roughly 40 cents of OpenAI credit. Good luck!

it reads from a file raw_urls.txt, which contain a list of github raw markdown urls

FOR INTERNAL USE ONLY. EVERY PROJECT SHOULD STILL BE MANUALLY CHECKED OVER AT THE END.

*/

import fs from "fs";
import fetch from "node-fetch";
import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are an assistant that analyzes Hack Club hardware journals in Markdown.
The user will provide the raw contents of JOURNAL.md files.

Rules:

1. Design Phase:
   - Text describing digital design (schematics, CAD, PCB, planning) counts as design text.
   - Must have at least one image (![](...)) in design-related content.

2. Build Phase:
   - Text describing physical build (soldering, assembly, firmware) counts as build text.
   - Must have at least one image (![](...)) in build-related content.
   - Images in the design section do NOT count.

Return JSON with:
- url
- design_text_present: true/false
- design_images_present: true/false
- build_text_present: true/false
- build_images_present: true/false
- design_justification: 1-2 sentence explanation mentioning text and images
- build_justification: 1-2 sentence explanation mentioning text and images
`;

async function analyzeJournal(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            return {
                url,
                design_text_present: false,
                design_images_present: false,
                build_text_present: false,
                build_images_present: false,
                design_justification: `Failed to fetch file (HTTP ${res.status}).`,
                build_justification: `Failed to fetch file (HTTP ${res.status}).`,
            };
        }

        const markdownContent = await res.text();

        const completion = await client.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Analyze this journal (from ${url}):\n\n${markdownContent}`,
                },
            ],
            response_format: { type: "json_object" },
        });

        const result = completion.choices[0].message.content;
        return JSON.parse(result);
    } catch (err) {
        console.log(err);
        return {
            url,
            design_text_present: false,
            design_images_present: false,
            build_text_present: false,
            build_images_present: false,
            design_justification: "Error during analysis.",
            build_justification: "Error during analysis.",
        };
    }
}

async function main() {
    const urlsText = fs.readFileSync("raw_urls.txt", "utf-8");
    const urls = urlsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const results = [];
    for (const url of urls) {
        console.log(`Analyzing: ${url}`);
        const result = await analyzeJournal(url);
        results.push(result);
    }

    fs.writeFileSync("results.json", JSON.stringify(results, null, 2));
    console.log("Analysis complete! Results saved to results.json");
}

main();
