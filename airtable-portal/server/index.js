import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const AIRTABLE_KEY = process.env.AIRTABLE_KEY;

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// --- Password protection middleware ---
const ACCESS_PASSWORD_HASH = process.env.ACCESS_PASSWORD_HASH;
if (!ACCESS_PASSWORD_HASH) {
    console.warn("⚠️  ACCESS_PASSWORD_HASH not set — server is unprotected!");
}

app.use(async (req, res, next) => {
    if (req.path.startsWith("/api")) {
        const provided = req.headers["x-access-password"] || req.body?.password;
        if (!ACCESS_PASSWORD_HASH) return next();
        if (!provided)
            return res.status(401).json({ error: "Password required" });
        const ok = await bcrypt.compare(provided, ACCESS_PASSWORD_HASH);
        if (!ok) return res.status(403).json({ error: "Invalid password" });
    }
    next();
});

const BASES = {
    alleyway: {
        displayName: "Alleyway Base — Projects",
        baseId: "appDURZvovIGtuZFz",
        tableName: "Projects",
        view: "Review view",
    },
    // add more entries here
};

// Get list of bases
app.get("/api/bases", (req, res) =>
    res.json(
        Object.entries(BASES).map(([id, { displayName }]) => ({
            id,
            name: displayName,
        }))
    )
);

// Get a record
app.get("/api/record", async (req, res) => {
    try {
        const { baseId, recordId } = req.query;
        const cfg = BASES.find((b) => b.id === baseId);
        if (!cfg) return res.status(404).json({ error: "Base not found" });

        const headers = { Authorization: `Bearer ${AIRTABLE_KEY}` };
        const recordUrl = `https://api.airtable.com/v0/${
            cfg.id
        }/${encodeURIComponent(cfg.tableName)}/${recordId}`;
        const recordResp = await axios.get(recordUrl, { headers });
        const record = recordResp.data;

        // Try metadata API
        let statusOptions = null;
        try {
            const metaUrl = `https://api.airtable.com/v0/meta/bases/${cfg.id}/tables`;
            const metaResp = await axios.get(metaUrl, { headers });
            const tables = metaResp.data?.tables || [];
            const table = tables.find((t) => t.name === cfg.tableName);
            const statusField = table?.fields?.find(
                (f) =>
                    f.type === "singleSelect" &&
                    f.name.toLowerCase() === "status"
            );
            if (statusField?.options?.choices?.length) {
                statusOptions = statusField.options.choices.map((c) => c.name);
            }
        } catch {
            console.log("[META] Metadata API unavailable, falling back");
        }

        // Fallback: derive from records
        if (!statusOptions) {
            const listUrl = `https://api.airtable.com/v0/${
                cfg.id
            }/${encodeURIComponent(cfg.tableName)}`;
            const listResp = await axios.get(listUrl, { headers });
            const records = listResp.data?.records || [];
            const statuses = new Set();
            for (const rec of records) {
                const val = rec.fields?.Status;
                if (val) statuses.add(val);
            }
            statusOptions = [...statuses];
        }

        res.json({
            record: record.fields,
            statusOptions,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update record status
app.post("/api/update", async (req, res) => {
    try {
        const { baseId, recordId, field, value } = req.body;
        const cfg = BASES.find((b) => b.id === baseId);
        if (!cfg) return res.status(404).json({ error: "Base not found" });

        const headers = {
            Authorization: `Bearer ${AIRTABLE_KEY}`,
            "Content-Type": "application/json",
        };
        const url = `https://api.airtable.com/v0/${cfg.id}/${encodeURIComponent(
            cfg.tableName
        )}/${recordId}`;

        const resp = await axios.patch(
            url,
            { fields: { [field]: value } },
            { headers }
        );

        res.json({ success: true, updated: resp.data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Serve the frontend ---
const distPath = path.join(__dirname, "../client/dist");
app.use(express.static(distPath));

// Catch-all (must be LAST route)
app.use((_, res) => {
    res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
