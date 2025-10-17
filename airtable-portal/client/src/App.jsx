import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export default function App() {
    const [password, setPassword] = useState("");
    const [authenticated, setAuthenticated] = useState(false);

    const [bases, setBases] = useState([]);
    const [selectedBase, setSelectedBase] = useState("");
    const [recordId, setRecordId] = useState("");
    const [record, setRecord] = useState(null);
    const [statusFieldName, setStatusFieldName] = useState("Status");
    const [statusOptions, setStatusOptions] = useState([]);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // --- helper to include password in requests ---
    const authedFetch = async (url, options = {}) => {
        const headers = {
            "x-access-password": password,
            ...(options.headers || {}),
        };
        return fetch(url, { ...options, headers });
    };

    // --- fetch bases after login ---
    useEffect(() => {
        if (!authenticated) return;
        authedFetch(`${API_BASE}/api/bases`)
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setBases(data);
                else setBases([]);
            })
            .catch(() => setBases([]));
    }, [authenticated]);

    async function handleLogin() {
        try {
            const res = await fetch(`${API_BASE}/api/bases`, {
                headers: { "x-access-password": password },
            });
            if (!res.ok) throw new Error("Invalid password");
            setAuthenticated(true);
            setMessage("");
        } catch (err) {
            setMessage(err.message || "Login failed");
        }
    }

    async function fetchRecord() {
        if (!selectedBase || !recordId) {
            setMessage("Select a base and provide a record ID");
            return;
        }
        setLoading(true);
        setMessage("");
        setRecord(null);
        setStatusOptions([]);
        try {
            const url = new URL(`${API_BASE}/api/record`);
            url.searchParams.set("baseId", selectedBase);
            url.searchParams.set("recordId", recordId);
            const resp = await authedFetch(url.toString());
            const data = await resp.json();
            if (resp.ok) {
                setRecord(data.record);
                const fields = data.record || {};
                const statusKey =
                    Object.keys(fields).find(
                        (k) => k.toLowerCase() === "status"
                    ) ||
                    Object.keys(fields)[0] ||
                    "Status";
                setStatusFieldName(statusKey);
                setSelectedStatus(fields[statusKey]);
                setStatusOptions(data.statusOptions || []);
            } else {
                setMessage(data.error || "Failed to fetch record");
            }
        } catch (err) {
            setMessage(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus() {
        if (!selectedBase || !recordId || !statusFieldName) {
            setMessage("Missing required info");
            return;
        }
        setLoading(true);
        setMessage("");
        try {
            const resp = await authedFetch(`${API_BASE}/api/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseId: selectedBase,
                    recordId,
                    field: statusFieldName,
                    value: selectedStatus,
                }),
            });
            const data = await resp.json();
            if (resp.ok) {
                setMessage("✅ Updated successfully");
                setRecord(data.updated?.fields || {});
            } else {
                setMessage(data.error || "Update failed");
            }
        } catch (err) {
            setMessage(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (!authenticated) {
        return (
            <div className="container login">
                <h1>🔐 Airtable Editor Login</h1>
                <input
                    type="password"
                    placeholder="Enter access password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button onClick={handleLogin}>Login</button>
                {message && <div className="message">{message}</div>}
            </div>
        );
    }

    return (
        <div className="container">
            <h1>Airtable Record Editor</h1>

            <label>Choose Base</label>
            <select
                value={selectedBase}
                onChange={(e) => setSelectedBase(e.target.value)}
            >
                <option value="">-- Pick a Base --</option>
                {bases.map((b) => (
                    <option key={b.id} value={b.id}>
                        {b.name}
                    </option>
                ))}
            </select>

            <label>Record ID</label>
            <input
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                placeholder="recXXXXXXXX"
            />

            <div className="row">
                <button onClick={fetchRecord} disabled={loading}>
                    Fetch Record
                </button>
            </div>

            {record && (
                <section className="card">
                    <h2>Record Details</h2>
                    <pre className="fields">
                        {JSON.stringify(record, null, 2)}
                    </pre>

                    <div>
                        <label>{statusFieldName}</label>
                        <select
                            value={selectedStatus || ""}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="">-- Choose --</option>
                            {statusOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                        <button onClick={updateStatus} disabled={loading}>
                            Update Status
                        </button>
                    </div>
                </section>
            )}

            {message && <div className="message">{message}</div>}

            <footer>
                <small>
                    🔒 Access controlled locally — no Cloudflare needed.
                </small>
            </footer>
        </div>
    );
}
