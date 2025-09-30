/**
 * Local Node.js script to sync HIGHWAY → Unified Projects
 *
 * Requirements:
 *   npm install node-fetch csv-parse
 *
 * Env vars needed:
 *   AIRTABLE_API_KEY=your_api_key
 */

import fs from "fs";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";
dotenv.config();

// --- CONFIG ---
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const HIGHWAY_BASE = "appuDQSHCdCHyOrxw";
const UNIFIED_BASE = "app3A5kJwYqxMLOgh";
const HIGHWAY_TABLE = "demo_base_view";
const UNIFIED_TABLE = "Approved Projects";
const UNIFIED_VIEW = "Highway View";

// --- Load CSV mapping ---
const csvText = fs.readFileSync("matched_pairs.csv", "utf8");
const rows = parse(csvText, { columns: true });

// Build mapping with your real column names
const matchedPairs = {};
for (let row of rows) {
    matchedPairs[row["Record_ID_highway"].trim()] =
        row["Record_ID_unified"].trim();
}

console.log(`Loaded ${Object.keys(matchedPairs).length} matches from CSV`);

// --- Airtable API helper ---
async function airtableFetch(baseId, tableName, params = "") {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
        tableName
    )}${params}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!res.ok) {
        let bodyText;
        try {
            bodyText = await res.text();
        } catch (e) {
            bodyText = `<no body: ${e.message}>`;
        }
        throw new Error(
            `Airtable fetch failed: ${res.status} ${res.statusText} - ${bodyText}`
        );
    }
    return res.json();
}

async function airtableUpdate(baseId, tableName, recordId, fields) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
        tableName
    )}/${recordId}`;
    const body = JSON.stringify({ fields });
    // Helpful debug log for request payloads (can be removed later)
    console.log(`PATCH ${url} -> ${body}`);
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
        body,
    });
    if (!res.ok) {
        let bodyText;
        try {
            bodyText = await res.text();
        } catch (e) {
            bodyText = `<no body: ${e.message}>`;
        }
        throw new Error(
            `Update failed: ${res.status} ${res.statusText} - ${bodyText}`
        );
    }
    return res.json();
}

// --- Main ---
async function main() {
    console.log(`Loaded ${rows.length} matches from CSV`);

    // Fetch HIGHWAY records
    let highwayRecords = [];
    let offset;
    do {
        let data = await airtableFetch(
            HIGHWAY_BASE,
            HIGHWAY_TABLE,
            offset ? `?offset=${offset}` : ""
        );
        highwayRecords.push(...data.records);
        offset = data.offset;
    } while (offset);

    console.log(`Fetched ${highwayRecords.length} HIGHWAY records`);

    // Fetch Unified records into lookup
    let unifiedRecords = {};
    offset = undefined;
    do {
        const queryParams =
            `?view=${encodeURIComponent(UNIFIED_VIEW)}` +
            (offset ? `&offset=${offset}` : "");
        let data = await airtableFetch(
            UNIFIED_BASE,
            UNIFIED_TABLE,
            queryParams
        );
        for (let rec of data.records) {
            unifiedRecords[rec.id] = rec;
        }
        offset = data.offset;
    } while (offset);

    console.log(
        `Fetched ${Object.keys(unifiedRecords).length} Unified records`
    );

    // Process
    let count = 0;
    for (let hRec of highwayRecords) {
        let fields = hRec.fields;
        let highwayId = fields["Record_ID"];
        let redditPost = fields["reddit_post"];
        let hoursAdjusted = fields["hours_adjusted"] || 0;
        let justification = fields["hour_justification"] || "";

        let unifiedId = matchedPairs[highwayId];
        if (!unifiedId) {
            console.log(`⚠️ No unified record found for HIGHWAY ${highwayId}`);
            continue;
        }

        let uRec = unifiedRecords[unifiedId];
        if (!uRec) {
            console.log(`⚠️ Unified record ${unifiedId} not found`);
            continue;
        }

        let currentPlayable = uRec.fields["Playable URL"] || "";
        let currentHours = uRec.fields["Override Hours Spent"] || 0;
        let currentJustification =
            uRec.fields["Override Hours Spent Justification"] || "";

        if (count < 3) {
            console.log(`\nAbout to update record:`);
            console.log(`HIGHWAY ID: ${highwayId}`);
            console.log(`Unified ID: ${unifiedId}`);
            console.log(`Playable URL → ${redditPost}`);
            console.log(
                `Override Hours Spent → ${currentHours} + ${hoursAdjusted}`
            );
            console.log(`Justification append: "${justification}"`);

            const userInput = await new Promise((resolve) => {
                process.stdout.write("Type 'continue' to proceed: ");
                process.stdin.once("data", (d) => resolve(d.toString().trim()));
            });
            if (userInput.toLowerCase() !== "continue") {
                console.log("⏩ Skipped this record.");
                count++;
                continue;
            }
        }

        // Use the same field keys as returned from Airtable and proper types.
        // "Playable URL" appears to be a URL field (single string), not an attachment.
        await airtableUpdate(UNIFIED_BASE, UNIFIED_TABLE, unifiedId, {
            "Playable URL": redditPost || "",
            "Override Hours Spent":
                Number(currentHours) + Number(hoursAdjusted),
            // match the existing justification key used when reading records
            "Override Hours Spent Justification": currentJustification
                ? currentJustification +
                  "\n\nAdditionally, when the user submitted their build, these hours were later added on. Here is the justification:\n\n" +
                  justification
                : justification,
        });

        console.log(`✅ Updated Unified record ${unifiedId}`);
        count++;
    }

    console.log(`\n---\nDone! Processed ${count} HIGHWAY records.`);
}

main().catch((err) => console.error(err));
