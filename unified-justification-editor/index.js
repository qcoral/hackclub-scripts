#!/usr/bin/env node

const dotenv = require("dotenv");
const Airtable = require("airtable");

dotenv.config();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = "Approved Projects";
const VIEW_NAME = "blueprint_hackpad_temp";
const FIELD_NAME = "Override Hours Spent Justification";
const MESSAGE =
    "This is a hackpad submitted for Blueprint initially reviewed by a hack clubber and then given a final pass by either @CAN or @alexren before being submitted to unified.\n\nThe hours were automatically set to 15 based on the median from 400+ hackpads that were hand reviewed.\n\nUnfortunately, individual hours were not collected at the time of submission due to an organization error. Regardless, this estimate should prove accurate as there were no changes in the program since we last collected indvidual hours\n\nFuture hackpads have hours individually collected. Any issues should go to @alexren.";

/*
old msg ref from highway

This is a highway project that was first reviewed and approved by Kai Peirera

The hours were automatically set to 12 in-line with historical data from over 300 macropads of hackpad, as well as a 3 hour buffer for any inaccuracies. A second review was given by alex before being fulfilled

Every project was given a final review by @alexren before being added to the unified YSWS DB. Please contact them if there are any issues
*/

/*
new msg


This is a hackpad submitted for Blueprint initially reviewed by a hack clubber and then given a final pass by either @CAN or @alexren before being submitted to unified.

The hours were automatically set to 15 based on the median from 400+ hackpads that were hand reviewed. 

Unfortunately, individual hours were not collected at the time of submission due to an organization error. Regardless, this estimate should prove accurate as there were no changes in the program since we last collected indvidual hours

Future hackpads have hours individually collected. Any issues should go to @alexren 

*/

if (!API_KEY) {
    console.error("Missing AIRTABLE_API_KEY in environment.");
    process.exit(1);
}

if (!MESSAGE) {
    console.error(
        "Usage: pnpm start -- <message to store in the override field>"
    );
    process.exit(1);
}

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

const BATCH_SIZE = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchRecords = async () => {
    const records = [];

    await base(TABLE_NAME)
        .select({ view: VIEW_NAME })
        .eachPage((pageRecords, fetchNextPage) => {
            records.push(...pageRecords);
            fetchNextPage();
        });

    return records;
};

const chunkRecords = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const buildUpdatePayload = (records) =>
    records.map(({ id }) => ({ id, fields: { [FIELD_NAME]: MESSAGE } }));

const updateBatch = async (batch) => {
    await base(TABLE_NAME).update(batch);
};

const main = async () => {
    try {
        console.log(`Loading records from ${TABLE_NAME} (${VIEW_NAME})...`);
        const records = await fetchRecords();

        if (!records.length) {
            console.log("No records found.");
            return;
        }

        console.log(`Updating ${records.length} records...`);
        const batches = chunkRecords(records, BATCH_SIZE);

        for (const [index, batch] of batches.entries()) {
            const payload = buildUpdatePayload(batch);
            await updateBatch(payload);
            console.log(
                `Updated batch ${index + 1} of ${batches.length} (${
                    payload.length
                } records).`
            );

            if (index !== batches.length - 1) {
                await sleep(210);
            }
        }

        console.log("Override field updated for all records.");
    } catch (error) {
        console.error("Failed to update override field.");
        console.error(error);
        process.exit(1);
    }
};

main();
