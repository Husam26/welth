export default function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 py-10">
      <div className="mx-auto max-w-6xl px-5 text-center">
        <p className="text-sm text-muted-foreground">
          Made with care by{" "}
          <span className="font-medium text-foreground">Husamuddin</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Welth. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
