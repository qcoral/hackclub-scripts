import csv

# File paths
input_file = "matched_pairs.csv"        # Replace with your actual file name
output_file = "matched_pairs_clean.csv"    # Output file

# Use a set to track seen Record IDs
seen_record_ids = set()
cleaned_data = []

with open(input_file, mode='r', newline='', encoding='utf-8') as infile:
    reader = csv.reader(infile)
    header = next(reader)
    cleaned_data.append(header)

    for row in reader:
        record_id = row[1]  # Assuming 'Record ID' is the second column
        if record_id not in seen_record_ids:
            seen_record_ids.add(record_id)
            cleaned_data.append(row)

# Write the cleaned data to a new CSV
with open(output_file, mode='w', newline='', encoding='utf-8') as outfile:
    writer = csv.writer(outfile)
    writer.writerows(cleaned_data)

print(f"Removed duplicates based on 'Record ID'. Saved cleaned file to '{output_file}'.")
