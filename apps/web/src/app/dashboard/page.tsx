"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { getErrorMessage, isUnauthorizedError } from "@/lib/errors"

type Loan = {
  id: string
  role: "LENDER" | "BORROWER"
  principalAmount: string
  status: "REQUESTED" | "ACTIVE" | "OVERDUE" | "REPAID" | "DEFAULTED"
  dueDate: string
}

const statusLabels: Record<Loan["status"], string> = {
  REQUESTED: "Awaiting response",
  ACTIVE: "Active",
  OVERDUE: "Overdue",
  REPAID: "Repaid",
  DEFAULTED: "Defaulted"
}

export default function DashboardPage() {
  const router = useRouter()
  const [name, setName] = useState<string | null>(null)
  const [loans, setLoans] = useState<Loan[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [me, loanList] = await Promise.all([
          api.users.getMe(),
          api.loans.list({})
        ])

        if (!cancelled) {
          setName(me.name)
          setLoans(loanList)
        }
      } catch (caughtError) {
        if (cancelled) {
          return
        }

        if (isUnauthorizedError(caughtError)) {
          router.push("/login")
        } else {
          setError(getErrorMessage(caughtError, "Couldn't load your loans."))
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-faint">
            {name ? `Welcome back, ${name.split(" ")[0]}` : "Welcome back"}
          </p>
          <h1 className="font-display mt-1 text-3xl text-ink">Your loans</h1>
        </div>
        <Link
          href="/loans/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-strong"
        >
          Start a loan
        </Link>
      </header>

      {error ? (
        <p className="mt-8 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : loans === null ? (
        <p className="mt-10 text-ink-faint">Loading…</p>
      ) : loans.length === 0 ? (
        <div className="mt-10 rounded-md border border-border bg-surface-sunken/40 px-6 py-10 text-center">
          <p className="text-ink-soft">
            No loans yet. Once you lend or borrow through vaada, they&rsquo;ll
            show up here.
          </p>
        </div>
      ) : (
        <div className="ledger-rules mt-8 rounded-md border border-border bg-surface-sunken/40 px-5">
          {loans.map((loan) => (
            <Link
              key={loan.id}
              href={`/loans/${loan.id}`}
              className="flex items-center justify-between py-6 hover:opacity-90"
            >
              <div>
                <p className="text-ink">
                  {loan.role === "LENDER" ? "You lent" : "You borrowed"}
                </p>
                <p className="mt-1 text-sm text-ink-faint">
                  Due {new Date(loan.dueDate).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular-figure text-lg text-ink">
                  ₹{loan.principalAmount}
                </p>
                <p className="mt-1 text-sm text-accent">
                  {statusLabels[loan.status]}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
