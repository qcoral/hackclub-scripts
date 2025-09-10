import fs from "fs";
import Airtable from "airtable";
import dotenv from "dotenv";

dotenv.config(); // Load .env file

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID; // your Airtable base ID
const TABLE_NAME = "demo_base_view"; // table name
const VIEW_NAME = "ai_sync"; // view name

if (!AIRTABLE_API_KEY || !BASE_ID) {
    console.error(
        "❌ Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in env vars"
    );
    process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(BASE_ID);

async function syncResults() {
    // Load results.json
    const results = JSON.parse(fs.readFileSync("results.json", "utf-8"));

    for (const entry of results) {
        const {
            url,
            build_text_present,
            build_images_present,
            build_justification,
        } = entry;

        console.log(`🔍 Looking for record with URL: ${url}`);

        // Find the record in the view with matching URL
        const records = await base(TABLE_NAME)
            .select({
                view: VIEW_NAME,
                filterByFormula: `{raw_url} = "${url}"`, // assumes you have a "url" field
            })
            .firstPage();

        if (records.length === 0) {
            console.warn(`⚠️ No record found for URL: ${url}`);
            continue;
        }

        const record = records[0];

        // Update fields
        await base(TABLE_NAME).update([
            {
                id: record.id,
                fields: {
                    build_text_present: build_text_present,
                    build_images_present: build_images_present,
                    ai_build_justification: build_justification,
                },
            },
        ]);

        console.log(`✅ Synced record for ${url}`);
    }
}

syncResults().catch((err) => {
    console.error("❌ Error syncing to Airtable:", err);
});
