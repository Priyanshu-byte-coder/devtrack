import os

filepath = "supabase/schema.sql"
with open(filepath, "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith("<<<<<<< HEAD"):
        continue
    elif line.startswith("======="):
        continue
    elif line.startswith(">>>>>>> upstream/main"):
        continue
    else:
        new_lines.append(line)

with open(filepath, "w") as f:
    f.writelines(new_lines)

print("Conflict markers removed from", filepath)
