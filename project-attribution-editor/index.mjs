// update-author.js
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import Airtable from "airtable";

dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    "app3A5kJwYqxMLOgh"
);

const TABLE_NAME = "Approved Projects";
const LINKED_FIELD = "YSWS–Weighted Project Author Attribution";
const ALEX_REN_RECORD_ID = "recE7jIAPWVvjxkCf"; // replace with actual record ID
const BATCH_SIZE = 10;

function loadCsv(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve(rows))
            .on("error", reject);
    });
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

async function updateRecords(csvPath) {
    const rows = await loadCsv(csvPath);

    // build updates
    const updates = rows
        .map((row) => row["Record ID"])
        .filter(Boolean)
        .map((recordId) => ({
            id: recordId,
            fields: { [LINKED_FIELD]: [ALEX_REN_RECORD_ID] },
        }));

    const batches = chunkArray(updates, BATCH_SIZE);

    for (const [i, batch] of batches.entries()) {
        try {
            await base(TABLE_NAME).update(batch);
            console.log(
                `✅ Batch ${i + 1}/${batches.length} updated (${
                    batch.length
                } records)`
            );
        } catch (err) {
            console.error(`❌ Batch ${i + 1} failed:`, err.message);
        }
    }
}

updateRecords("matched_pairs_clean.csv");
