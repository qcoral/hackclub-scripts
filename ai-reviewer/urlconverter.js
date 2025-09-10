/*
    This file goes through a list of GitHub repository links, finds the JOURNAL.md file,
    and grabs the raw usercontent URL for it. 
    
    It checks for different capitalizations since github is case sensitive.

    The output is saved to rawurls.txt
*/
const fs = require("fs");
const https = require("https");

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ""; // Set this environment variable

async function checkJournalFile(repoUrl) {
    try {
        const urlParts = repoUrl.split("/");
        const owner = urlParts[3];
        const repo = urlParts[4];

        if (!owner || !repo) {
            console.log(`Invalid GitHub URL: ${repoUrl}`);
            return null;
        }

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/`;
        const possibleFiles = [
            "journal.md",
            "JOURNAL.md",
            "Journal.md",
            "JOURNAL.MD",
            "journal.MD",
            "Journal.MD",
        ];

        for (const filename of possibleFiles) {
            try {
                const response = await makeRequest(`${apiUrl}${filename}`);

                if (response.statusCode === 200) {
                    const data = JSON.parse(response.data);
                    if (data && data.download_url) {
                        return data.download_url;
                    }
                }
                // If not 200, try next filename
            } catch (error) {
                // Continue to next filename on errors
                continue;
            }
        }

        return null; // No journal file found
    } catch (error) {
        console.log(`Error processing ${repoUrl}: ${error.message}`);
        return null;
    }
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const headers = {
            "User-Agent": "Journal-Finder-Script",
            Accept: "application/vnd.github.v3+json",
        };

        // Add authentication if available
        if (GITHUB_TOKEN) {
            headers["Authorization"] = `token ${GITHUB_TOKEN}`;
        }

        const options = { headers, timeout: 10000 };

        const req = https.get(url, options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                resolve({
                    statusCode: res.statusCode,
                    data: data,
                });
            });
        });

        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });
    });
}

async function main() {
    try {
        // Check if we have a token for better rate limits
        if (!GITHUB_TOKEN) {
            console.log(
                "⚠ No GITHUB_TOKEN found. Using unauthenticated API (60 requests/hour)"
            );
            console.log(
                "   Set GITHUB_TOKEN environment variable for 5000 requests/hour"
            );
        } else {
            console.log("✓ Using GitHub token for higher rate limits");
        }

        // Read URLs
        const urls = fs
            .readFileSync("urls.txt", "utf8")
            .split("\n")
            .map((url) => url.trim())
            .filter((url) => url && url.startsWith("https://github.com/"));

        if (urls.length === 0) {
            console.error("No valid GitHub URLs found");
            return;
        }

        fs.writeFileSync("rawurls.txt", "");
        console.log(`Processing ${urls.length} repositories...`);

        // Process URLs one by one
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`\n[${i + 1}/${urls.length}] Checking: ${url}`);

            const result = await checkJournalFile(url);

            if (result) {
                fs.appendFileSync("rawurls.txt", result + "\n");
                console.log(`✓ Found: ${result}`);
            } else {
                console.log(`✗ No journal found for ${url}`);
            }
        }

        console.log("\n✅ Processing complete!");
    } catch (error) {
        console.error("Fatal Error:", error.message);
    }
}

// Run the script
main();
