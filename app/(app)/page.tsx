export default function Home() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="size-2 rounded-full bg-primary" />
      <p className="text-sm text-muted-foreground">
        Select a note, or press{" "}
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd> to search.
      </p>
    </div>
  );
}
