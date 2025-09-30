import csv
import re
import difflib

# Input file names
highway_file = "highway_demos.csv"
unified_file = "unified_projects.csv"

# Output file names
matches_out = "matched_pairs.csv"
unmatched_out = "unmatched_highway.csv"
possible_out = "possible_matches.csv"


def normalize_github_url(url):
    """Turn a GitHub URL into 'username/repo'"""
    if not url:
        return None
    s = url.strip()
    m = re.search(r"github\.com[:/]+([^/]+)/([^/\s?#]+)", s, flags=re.IGNORECASE)
    if m:
        user, repo = m.group(1).lower(), m.group(2).lower()
        repo = re.sub(r"(\.git$|/+$)", "", repo)
        repo = re.split(r"[\?#@]", repo)[0]
        return f"{user}/{repo}"
    # fallback: string already looks like username/repo
    m2 = re.match(r"^\s*([^/\s]+)/([^/\s]+)\s*$", s)
    if m2:
        user, repo = m2.group(1).lower(), m2.group(2).lower()
        repo = repo.rstrip("/").replace(".git", "")
        return f"{user}/{repo}"
    return None


def find_column(columns, target):
    for c in columns:
        if target.lower() in c.lower():
            return c
    raise KeyError(f"Could not find column containing '{target}' in {columns}")


# --- Load highway_demos ---
with open(highway_file, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    highway_cols = reader.fieldnames
    record_col_highway = find_column(highway_cols, "record")
    github_col_highway = find_column(highway_cols, "git")
    highway = []
    for row in reader:
        row["normalized_repo"] = normalize_github_url(row.get(github_col_highway, ""))
        row["_record_id"] = row.get(record_col_highway, "")
        highway.append(row)

# --- Load unified_projects ---
with open(unified_file, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    unified_cols = reader.fieldnames
    record_col_unified = find_column(unified_cols, "record")
    playable_col = find_column(unified_cols, "play")
    code_col = find_column(unified_cols, "code")
    unified = []
    for row in reader:
        playable = normalize_github_url(row.get(playable_col, ""))
        code = normalize_github_url(row.get(code_col, ""))
        row["normalized_repo"] = playable or code
        row["_record_id"] = row.get(record_col_unified, "")
        unified.append(row)

# Build lookup for unified repos
unified_lookup = {row["normalized_repo"]: row["_record_id"] for row in unified if row["normalized_repo"]}

# --- Exact matches ---
matches = []
unmatched = []
for row in highway:
    repo = row["normalized_repo"]
    if repo and repo in unified_lookup:
        matches.append({
            "Record_ID_highway": row["_record_id"],
            "Record_ID_unified": unified_lookup[repo],
            "normalized_repo": repo
        })
    else:
        unmatched.append({
            "Record_ID": row["_record_id"],
            "Github_Url": row.get(github_col_highway, ""),
            "normalized_repo": repo or ""
        })

# --- Fuzzy matches for unmatched ---
possible = []
unified_repos = list(unified_lookup.keys())

for row in unmatched:
    repo = row["normalized_repo"]
    if not repo:
        continue
    if "/" not in repo:
        continue
    user, name = repo.split("/", 1)

    # Compare only repo names
    repo_names = [r.split("/", 1)[1] for r in unified_repos if "/" in r]
    closest_names = difflib.get_close_matches(name, repo_names, n=3, cutoff=0.8)
    for cname in closest_names:
        # find all unified repos with this repo name
        for r in unified_repos:
            if r.endswith("/" + cname):
                possible.append({
                    "Record_ID_highway": row["Record_ID"],
                    "Github_Url_highway": row["Github_Url"],
                    "normalized_repo_highway": repo,
                    "Record_ID_unified": unified_lookup[r],
                    "normalized_repo_unified": r,
                    "match_reason": "similar repo name"
                })

    # Compare only usernames
    usernames = [r.split("/", 1)[0] for r in unified_repos if "/" in r]
    closest_users = difflib.get_close_matches(user, usernames, n=3, cutoff=0.8)
    for cu in closest_users:
        for r in unified_repos:
            if r.startswith(cu + "/") and r.split("/", 1)[1] == name:
                possible.append({
                    "Record_ID_highway": row["Record_ID"],
                    "Github_Url_highway": row["Github_Url"],
                    "normalized_repo_highway": repo,
                    "Record_ID_unified": unified_lookup[r],
                    "normalized_repo_unified": r,
                    "match_reason": "same repo name, similar username"
                })

# --- Write output files ---
with open(matches_out, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["Record_ID_highway", "Record_ID_unified", "normalized_repo"])
    writer.writeheader()
    writer.writerows(matches)

with open(unmatched_out, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["Record_ID", "Github_Url", "normalized_repo"])
    writer.writeheader()
    writer.writerows(unmatched)

with open(possible_out, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "Record_ID_highway", "Github_Url_highway", "normalized_repo_highway",
        "Record_ID_unified", "normalized_repo_unified", "match_reason"
    ])
    writer.writeheader()
    writer.writerows(possible)

print(f"Done! {len(matches)} exact matches, {len(unmatched)} unmatched, {len(possible)} possible fuzzy matches.")
