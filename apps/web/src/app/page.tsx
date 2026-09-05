import Link from "next/link"

const exampleLoans = [
  {
    borrower: "Priya, cousin",
    amount: "25,000",
    status: "Active",
    detail: "Due in 4 months"
  },
  {
    borrower: "Arjun, college friend",
    amount: "8,000",
    status: "Repaid",
    detail: "Closed 2 weeks ago"
  },
  {
    borrower: "Neha, neighbour",
    amount: "50,000",
    status: "Requested",
    detail: "Awaiting her acceptance"
  }
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
        <span className="font-display text-xl tracking-tight text-ink">
          vaada
        </span>
        <Link
          href="/login"
          className="text-sm text-ink-soft transition-colors hover:text-accent"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        <section className="py-20">
          <h1 className="font-display max-w-2xl text-5xl leading-tight text-ink">
            A promise, written down.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            You already trust them enough to lend the money. Vaada just
            keeps the proof, so trust doesn&rsquo;t have to carry the whole
            weight alone.
          </p>
          <div className="mt-10 flex gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-strong hover:text-ink"
            >
              Start a loan
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-md border border-border-strong px-5 py-3 text-sm font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              See how it works
            </Link>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-border py-16">
          <p className="max-w-md text-ink-soft">
            Every loan on vaada looks like this — visible to both people,
            never just one person&rsquo;s word against the other&rsquo;s.
          </p>

          <div className="ledger-rules mt-8 rounded-md border border-border bg-surface-sunken/40 px-5">
            {exampleLoans.map((loan) => (
              <div
                key={loan.borrower}
                className="flex items-center justify-between py-6"
              >
                <div>
                  <p className="text-ink">{loan.borrower}</p>
                  <p className="mt-1 text-sm text-ink-faint">{loan.detail}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-figure text-lg text-ink">
                    ₹{loan.amount}
                  </p>
                  <p className="mt-1 text-sm text-accent">{loan.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-16 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl text-ink">
              Terms can change. Consent can&rsquo;t be skipped.
            </h2>
            <p className="mt-3 text-ink-soft">
              If the interest rate or due date needs to change later, the
              other person has to agree to it again before it takes effect.
              Nothing changes quietly.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink">
              If it goes wrong, there&rsquo;s a record.
            </h2>
            <p className="mt-3 text-ink-soft">
              Every note, every reminder, every change is kept and can be
              downloaded as a document you can actually show someone.
            </p>
          </div>
        </section>

        <footer className="border-t border-border py-10 text-sm text-ink-faint">
          vaada
        </footer>
      </main>
    </div>
  )
}
