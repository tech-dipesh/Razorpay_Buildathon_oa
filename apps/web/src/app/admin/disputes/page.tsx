"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { getErrorMessage, isUnauthorizedError } from "@/lib/errors"

type Dispute = {
  id: string
  loanId: string
  trigger: "MANUAL" | "AUTOMATIC"
  reason: string
  createdAt: string
}

export default function AdminDisputesPage() {
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await api.reports.listOpenDisputes()
      setDisputes(result)
    } catch (caughtError) {
      if (isUnauthorizedError(caughtError)) {
        router.push("/login")
        return
      }

      setError(getErrorMessage(caughtError, "Couldn't load open disputes."))
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  async function handleResolve(disputeId: string) {
    setBusyId(disputeId)

    try {
      await api.loans.resolveDispute({ disputeId })
      await load()
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Couldn't resolve the dispute."))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <nav className="flex gap-4 text-sm text-ink-faint">
        <Link href="/admin/reports" className="hover:text-accent">
          Batch report
        </Link>
        <Link href="/admin/disputes" className="text-accent">
          Open disputes
        </Link>
      </nav>

      <h1 className="font-display mt-6 text-3xl text-ink">Open disputes</h1>

      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}

      {disputes === null ? (
        <p className="mt-8 text-ink-faint">Loading…</p>
      ) : disputes.length === 0 ? (
        <p className="mt-8 text-ink-faint">Nothing open right now.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              className="rounded-md border border-border bg-surface-sunken/40 p-4"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/loans/${dispute.loanId}`}
                  className="text-sm text-accent hover:underline"
                >
                  View loan
                </Link>
                <span className="text-sm text-ink-faint">
                  {dispute.trigger === "MANUAL" ? "Raised by a user" : "Auto-flagged"}
                </span>
              </div>
              <p className="mt-2 text-ink">{dispute.reason}</p>
              <p className="mt-1 text-sm text-ink-faint">
                {new Date(dispute.createdAt).toLocaleString()}
              </p>
              <button
                onClick={() => handleResolve(dispute.id)}
                disabled={busyId === dispute.id}
                className="mt-3 rounded-md border border-border-strong px-3 py-1.5 text-sm text-ink-soft hover:border-accent hover:text-accent disabled:opacity-60"
              >
                Mark resolved
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
