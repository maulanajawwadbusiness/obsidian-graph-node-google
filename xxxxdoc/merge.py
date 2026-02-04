from pathlib import Path

folder = Path(".")          # current folder
out_path = folder / "merged.txt"

txt_files = sorted(folder.glob("*.txt"), key=lambda p: p.name.lower())

with out_path.open("w", encoding="utf-8", newline="\n") as out:
    for i, path in enumerate(txt_files, start=1):
        out.write(f"file {i} - {path.name}\n\n")
        out.write(path.read_text(encoding="utf-8", errors="replace"))
        out.write("\n\n" + "-"*40 + "\n\n")

print(f"wrote: {out_path.resolve()}")
