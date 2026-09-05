"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { getErrorMessage, isUnauthorizedError } from "@/lib/errors"

type BatchReport = {
  id: string
  totalLoans: number
  totalRecoveredAmount: string
  recoveryRate: string
  averageResolutionDays: string
  generatedAt: string
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [report, setReport] = useState<BatchReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.reports
      .getLatestBatchReport()
      .then((result) => setReport(result))
      .catch((caughtError: unknown) => {
        if (isUnauthorizedError(caughtError)) {
          router.push("/login")
          return
        }

        setError(getErrorMessage(caughtError, "Couldn't load the report."))
      })
  }, [router])

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <nav className="flex gap-4 text-sm text-ink-faint">
        <Link href="/admin/reports" className="text-accent">
          Batch report
        </Link>
        <Link href="/admin/disputes" className="hover:text-accent">
          Open disputes
        </Link>
      </nav>

      <h1 className="font-display mt-6 text-3xl text-ink">Recovery report</h1>

      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}

      {report ? (
        <div className="ledger-rules mt-8 rounded-md border border-border bg-surface-sunken/40 px-5">
          <div className="flex items-center justify-between py-4">
            <span className="text-ink-soft">Total loans</span>
            <span className="tabular-figure text-ink">{report.totalLoans}</span>
          </div>
          <div className="flex items-center justify-between py-4">
            <span className="text-ink-soft">Recovered</span>
            <span className="tabular-figure text-ink">
              ₹{report.totalRecoveredAmount}
            </span>
          </div>
          <div className="flex items-center justify-between py-4">
            <span className="text-ink-soft">Recovery rate</span>
            <span className="tabular-figure text-accent">
              {report.recoveryRate}%
            </span>
          </div>
          <div className="flex items-center justify-between py-4">
            <span className="text-ink-soft">Avg. days to resolve</span>
            <span className="tabular-figure text-ink">
              {report.averageResolutionDays}
            </span>
          </div>
          <div className="flex items-center justify-between py-4">
            <span className="text-ink-soft">Generated</span>
            <span className="text-ink">
              {new Date(report.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      ) : !error ? (
        <p className="mt-8 text-ink-faint">Loading…</p>
      ) : null}
    </div>
  )
}
