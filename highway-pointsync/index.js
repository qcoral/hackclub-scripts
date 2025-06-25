const Airtable = require("airtable");
const dotenv = require("dotenv");
const csv = require("csv-parser");
const fs = require('fs');
dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
);

async function tickFromCsv(csvFilePath) {
    const emailsFromCsv = new Set();

    // 1. Read emails from CSV
    await new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                // Assumes the column is called 'email' (case-insensitive)
                const email = row.email || row.Email || row[Object.keys(row)[0]];
                if (email) emailsFromCsv.add(email.trim());
            })
            .on('end', resolve)
            .on('error', reject);
    });

    // 2. Fetch all existing records from Airtable
    const existingRecords = await base("sidequests").select().all();
    const emailToRecord = new Map();
    existingRecords.forEach(record => {
        const email = record.get('email');
        if (email) emailToRecord.set(email.trim(), record.id);
    });

    // 3. Prepare batch updates and creates
    const updates = [];
    const creates = [];
    for (const email of emailsFromCsv) {
        if (emailToRecord.has(email)) {
            updates.push({
                id: emailToRecord.get(email),
                fields: { roadtrip_call_1: true }
            });
            console.log(`🔄 Updating kickoff_call for ${email}`);
        } else {
            creates.push({
                fields: { email, roadtrip_call_1: true }
            });
            console.log(`🆕 Creating record for ${email} with kickoff_call`);
        }
    }

    // 4. Batch process updates and creates (10 at a time)
    async function batchProcess(records, action) {
        for (let i = 0; i < records.length; i += 10) {
            const batch = records.slice(i, i + 10);
            try {
                await base("sidequests")[action](batch);
            } catch (err) {
                console.error(`❌ Failed to ${action} batch:`, err.message);
            }
        }
    }
    await batchProcess(updates, 'update');
    await batchProcess(creates, 'create');
    console.log('✅ Done syncing kickoff_call field from CSV.');
}

// Example usage:
tickFromCsv('roadtrip_sync.csv');
// (Make sure to call this with the correct CSV file path)