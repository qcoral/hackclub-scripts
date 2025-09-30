const Airtable = require("airtable");
const dotenv = require("dotenv");
dotenv.config();

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
);

async function updateLeaderboard() {
    try {
        // 1. Calculate combined points
        const users = await getCombinedPoints();

        if (Object.keys(users).length === 0) {
            console.log("No user data found to update");
            return { success: true, count: 0 };
        }

        // 2. Get existing leaderboard records
        const existingRecords = await base("leaderboard").select().all();
        const existingEmails = new Map();

        existingRecords.forEach((record) => {
            existingEmails.set(record.get("email"), record.id);
        });

        // 3. Prepare batch updates and creates
        const updates = [];
        const creates = [];

        for (const [email, data] of Object.entries(users)) {
            const recordData = {
                email: email,
                slack_id: data.slack_id || "",
                // Always sum project_points and sidequest_points for total_points
                total_points:
                    (data.project_points || 0) + (data.sidequest_points || 0),
            };
            if (existingEmails.has(email)) {
                updates.push({
                    id: existingEmails.get(email),
                    fields: recordData,
                });
                // Debugging: log update action
                console.log(
                    `🔄 Updating ${email} (${existingEmails.get(email)}) with ${
                        recordData.total_points
                    } points`
                );
            } else {
                creates.push({
                    fields: recordData,
                });
                // Debugging: log create action
                console.log(
                    `🆕 Creating ${email} with ${recordData.total_points} points`
                );
            }
        }

        // Helper to batch process records
        async function batchProcess(records, action) {
            let count = 0;
            for (let i = 0; i < records.length; i += 10) {
                const batch = records.slice(i, i + 10);
                try {
                    await base("leaderboard")[action](batch);
                    count += batch.length;
                } catch (error) {
                    console.error(
                        `❌ Failed to ${action} batch:`,
                        error.message
                    );
                }
            }
            return count;
        }

        // 4. Execute batched updates and creates
        const updateCount = await batchProcess(updates, "update");
        const createCount = await batchProcess(creates, "create");

        console.log(
            `✅ Leaderboard update complete: ${updateCount} updates, ${createCount} creates`
        );
        return {
            success: true,
            updated: updateCount,
            created: createCount,
        };
    } catch (error) {
        console.error("⛔ Error updating leaderboard:", error);
        return { success: false, error: error.message };
    }
}

async function getCombinedPoints() {
    const users = {};

    try {
        // Fetch all records from your table
        const records = await base(process.env.AIRTABLE_PROJECT_TABLE_ID)
            .select({
                filterByFormula: "{Status} = 'Fulfilled'",
                // You can add filters or sorting here if needed
            })
            .all();

        const sidequests = await base("sidequests").select().all();

        // Process each record
        records.forEach((record) => {
            // console.log(record);
            const email = record.get("Email"); // Assuming you have an email field
            const slackId = record.get("slack_id");
            const points = record.get("points") || 0;

            let numericPoints = points;

            if (email) {
                if (!users[email]) {
                    users[email] = {
                        slack_id: slackId,
                        project_points: 0,
                        sidequest_points: 0,
                        total_points: 0,
                    };
                }

                users[email].project_points += numericPoints;
                users[email].total_points += numericPoints;

                // Update slack_id if not already set
                if (slackId && !users[email].slack_id) {
                    users[email].slack_id = slackId;
                }
            }
        });

        // Process sidequests
        sidequests.forEach((record) => {
            const email = record.get("email");
            if (!email) return;

            // Initialize user if not exists
            if (!users[email]) {
                users[email] = {
                    slack_id: null,
                    project_points: 0,
                    sidequest_points: 0,
                    total_points: 0,
                };
            }

            // Count checked checkboxes
            let checkedCount = 0;
            const fields = record.fields;
            for (const key in fields) {
                if (fields[key] === true) {
                    // Check if it's a checked checkbox
                    checkedCount++;
                }
            }

            users[email].sidequest_points += checkedCount;
            users[email].total_points += checkedCount;
        });

        // Convert to the desired JSON format
        return users;
    } catch (error) {
        console.error("Error fetching data from Airtable:", error);
        return {};
    }
}

// Usage
updateLeaderboard().then((result) => {
    console.log(JSON.stringify(result, null, 2));
});
