"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { getErrorMessage, isUnauthorizedError } from "@/lib/errors"

type Loan = {
  id: string
  lenderId: string
  borrowerId: string
  principalAmount: string
  interestRate: string
  compoundingFrequency: string
  repaymentType: string
  tenureMonths: number
  dueDate: string
  status: "REQUESTED" | "ACTIVE" | "OVERDUE" | "REPAID" | "DEFAULTED"
  relationship: string | null
}

type TimelineEvent = {
  type: "CONSENSUS_CHECK" | "DISPUTE_BRIEF" | "NOTIFICATION"
  occurredAt: string
  summary: string
  reasoning: string
}

type Amendment = {
  id: string
  version: number
  principalAmount: string
  interestRate: string
  compoundingFrequency: string
  tenureMonths: number
  dueDate: string
  status: "PENDING" | "ACCEPTED" | "REJECTED"
  proposedByUserId: string
  createdAt: string
}

const statusLabels: Record<Loan["status"], string> = {
  REQUESTED: "Awaiting response",
  ACTIVE: "Active",
  OVERDUE: "Overdue",
  REPAID: "Repaid",
  DEFAULTED: "Defaulted"
}

export default function LoanDetailPage() {
  const params = useParams<{ loanId: string }>()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loan, setLoan] = useState<Loan | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null)
  const [amendments, setAmendments] = useState<Amendment[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [repaymentAmount, setRepaymentAmount] = useState("")
  const [disputeReason, setDisputeReason] = useState("")
  const [showDisputeForm, setShowDisputeForm] = useState(false)

  const [showAmendmentForm, setShowAmendmentForm] = useState(false)
  const [amendPrincipal, setAmendPrincipal] = useState("")
  const [amendInterest, setAmendInterest] = useState("")
  const [amendTenure, setAmendTenure] = useState("")
  const [amendDueDate, setAmendDueDate] = useState("")

  const [consensusAction, setConsensusAction] = useState<
    "DECLARE_DEFAULT" | "DEMAND_NOTICE"
  >("DEMAND_NOTICE")
  const [consensusResult, setConsensusResult] = useState<{
    agreementReached: boolean
    requiresHumanReview: boolean
  } | null>(null)

  const load = useCallback(async () => {
    try {
      const [me, loanDetail, timelineEvents, amendmentList] = await Promise.all([
        api.users.getMe(),
        api.loans.get({ loanId: params.loanId }),
        api.loans.getTimeline({ loanId: params.loanId }),
        api.loans.listAmendments({ loanId: params.loanId })
      ])

      setUserId(me.id)
      setLoan(loanDetail)
      setTimeline(timelineEvents)
      setAmendments(amendmentList)
      setLoadError(null)
    } catch (caughtError) {
      if (isUnauthorizedError(caughtError)) {
        router.push("/login")
      } else {
        setLoadError(getErrorMessage(caughtError, "Couldn't load this loan."))
      }
    }
  }, [params.loanId, router])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAccept() {
    setBusy(true)
    setActionError(null)

    try {
      await api.loans.accept({ loanId: params.loanId })
      await load()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't accept the loan."
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRepayment() {
    setBusy(true)
    setActionError(null)

    try {
      await api.loans.createRepayment({
        loanId: params.loanId,
        amount: Number(repaymentAmount)
      })
      setRepaymentAmount("")
      await load()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't start the repayment."
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDispute() {
    setBusy(true)
    setActionError(null)

    try {
      await api.loans.raiseDispute({
        loanId: params.loanId,
        reason: disputeReason
      })
      setDisputeReason("")
      setShowDisputeForm(false)
      await load()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't raise the dispute."
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleProposeAmendment() {
    if (!loan || !amendDueDate) {
      return
    }

    setBusy(true)
    setActionError(null)

    try {
      await api.loans.proposeAmendment({
        loanId: params.loanId,
        principalAmount: Number(amendPrincipal),
        interestRate: Number(amendInterest),
        compoundingFrequency: loan.compoundingFrequency as
          | "MONTHLY"
          | "QUARTERLY"
          | "ANNUALLY",
        tenureMonths: Number(amendTenure),
        dueDate: new Date(amendDueDate).toISOString()
      })
      setShowAmendmentForm(false)
      setAmendPrincipal("")
      setAmendInterest("")
      setAmendTenure("")
      setAmendDueDate("")
      await load()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't propose the change."
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleAmendmentResponse(amendmentId: string, accept: boolean) {
    setBusy(true)
    setActionError(null)

    try {
      if (accept) {
        await api.loans.acceptAmendment({ loanId: params.loanId, amendmentId })
      } else {
        await api.loans.rejectAmendment({ loanId: params.loanId, amendmentId })
      }
      await load()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't respond to the change."
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleConsensusCheck() {
    setBusy(true)
    setActionError(null)
    setConsensusResult(null)

    try {
      const result = await api.ai.triggerConsensusCheck({
        loanId: params.loanId,
        actionType: consensusAction
      })
      setConsensusResult(result)
      await load()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't run the consensus check."
      )
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/dashboard" className="text-sm text-ink-faint hover:text-accent">
          ← Back to your loans
        </Link>
        <p className="mt-6 text-danger" role="alert">
          {loadError}
        </p>
      </div>
    )
  }

  if (!loan || !userId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-ink-faint">Loading…</p>
      </div>
    )
  }

  const isBorrower = userId === loan.borrowerId
  const isLender = userId === loan.lenderId
  const pendingAmendment = amendments.find((a) => a.status === "PENDING")

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-ink-faint hover:text-accent">
        ← Back to your loans
      </Link>

      <div className="mt-4 flex items-baseline justify-between">
        <p className="tabular-figure font-display text-4xl text-ink">
          ₹{loan.principalAmount}
        </p>
        <p className="text-accent">{statusLabels[loan.status]}</p>
      </div>

      <div className="ledger-rules mt-8 rounded-md border border-border bg-surface-sunken/40 px-5">
        <div className="flex items-center justify-between py-4">
          <span className="text-ink-soft">Interest rate</span>
          <span className="tabular-figure text-ink">{loan.interestRate}%</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-ink-soft">Compounds</span>
          <span className="text-ink">{loan.compoundingFrequency.toLowerCase()}</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-ink-soft">Repayment</span>
          <span className="text-ink">
            {loan.repaymentType === "LUMP_SUM" ? "Lump sum" : "Installments"}
          </span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-ink-soft">Tenure</span>
          <span className="text-ink">{loan.tenureMonths} months</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-ink-soft">Due</span>
          <span className="text-ink">
            {new Date(loan.dueDate).toLocaleDateString()}
          </span>
        </div>
        {loan.relationship ? (
          <div className="flex items-center justify-between py-4">
            <span className="text-ink-soft">Relationship</span>
            <span className="text-ink">{loan.relationship}</span>
          </div>
        ) : null}
      </div>

      {actionError ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      {pendingAmendment ? (
        <div className="mt-6 rounded-md border border-accent/40 bg-accent-wash p-4">
          <p className="text-sm text-ink">
            {pendingAmendment.proposedByUserId === userId
              ? "You proposed a change, waiting on them"
              : "They proposed a change to the terms"}
          </p>
          <div className="tabular-figure mt-2 text-sm text-ink-soft">
            ₹{pendingAmendment.principalAmount} at {pendingAmendment.interestRate}%,{" "}
            {pendingAmendment.tenureMonths} months, due{" "}
            {new Date(pendingAmendment.dueDate).toLocaleDateString()}
          </div>
          {isBorrower && pendingAmendment.proposedByUserId !== userId ? (
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => handleAmendmentResponse(pendingAmendment.id, true)}
                disabled={busy}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-60"
              >
                Accept
              </button>
              <button
                onClick={() => handleAmendmentResponse(pendingAmendment.id, false)}
                disabled={busy}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-ink-soft hover:text-danger disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col divide-y divide-border">
        {isBorrower && loan.status === "REQUESTED" ? (
          <div className="py-5 first:pt-0">
            <button
              onClick={handleAccept}
              disabled={busy}
              className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-60"
            >
              Accept this loan
            </button>
          </div>
        ) : null}

        {isBorrower && (loan.status === "ACTIVE" || loan.status === "OVERDUE") ? (
          <div className="py-5 first:pt-0">
            <p className="text-ink">
              I&rsquo;m paying{" "}
              <input
                type="number"
                min="1"
                aria-label="Repayment amount"
                value={repaymentAmount}
                onChange={(event) => setRepaymentAmount(event.target.value)}
                placeholder="amount"
                className="tabular-figure inline-block w-24 rounded bg-surface px-2 py-0.5 text-ink-soft outline-none focus:ring-1 focus:ring-accent"
              />{" "}
              toward this.
            </p>
            <button
              onClick={handleRepayment}
              disabled={busy || !repaymentAmount}
              className="mt-3 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-60"
            >
              Pay
            </button>
          </div>
        ) : null}

        {isLender && loan.status === "ACTIVE" && !pendingAmendment ? (
          <div className="py-5 first:pt-0">
            {showAmendmentForm ? (
              <>
                <p className="text-ink">
                  I&rsquo;d like to change this to{" "}
                  <input
                    type="number"
                    aria-label="New amount"
                    placeholder="amount"
                    value={amendPrincipal}
                    onChange={(event) => setAmendPrincipal(event.target.value)}
                    className="tabular-figure inline-block w-24 rounded bg-surface px-2 py-0.5 text-ink-soft outline-none focus:ring-1 focus:ring-accent"
                  />{" "}
                  at{" "}
                  <input
                    type="number"
                    step="0.1"
                    aria-label="New interest rate"
                    placeholder="rate"
                    value={amendInterest}
                    onChange={(event) => setAmendInterest(event.target.value)}
                    className="tabular-figure inline-block w-14 rounded bg-surface px-2 py-0.5 text-ink-soft outline-none focus:ring-1 focus:ring-accent"
                  />
                  %,{" "}
                  <input
                    type="number"
                    aria-label="New tenure in months"
                    placeholder="months"
                    value={amendTenure}
                    onChange={(event) => setAmendTenure(event.target.value)}
                    className="inline-block w-20 rounded bg-surface px-2 py-0.5 text-ink outline-none focus:ring-1 focus:ring-accent"
                  />{" "}
                  months, due{" "}
                  <input
                    type="date"
                    aria-label="New due date"
                    value={amendDueDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(event) => setAmendDueDate(event.target.value)}
                    className="inline-block w-40 rounded bg-surface px-2 py-0.5 text-ink outline-none focus:ring-1 focus:ring-accent"
                  />
                  .
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handleProposeAmendment}
                    disabled={busy}
                    className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-60"
                  >
                    Send proposal
                  </button>
                  <button
                    onClick={() => setShowAmendmentForm(false)}
                    className="text-sm text-ink-faint hover:text-ink-soft"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowAmendmentForm(true)}
                className="text-sm text-ink-faint hover:text-accent"
              >
                Propose new terms
              </button>
            )}
          </div>
        ) : null}

        {isLender && (loan.status === "ACTIVE" || loan.status === "OVERDUE") ? (
          <div className="py-5 first:pt-0">
            <p className="text-sm text-ink-faint">
              Ask two AI providers whether this warrants action
            </p>
            <div className="mt-2 flex items-center gap-3">
              <select
                value={consensusAction}
                onChange={(event) =>
                  setConsensusAction(
                    event.target.value as "DECLARE_DEFAULT" | "DEMAND_NOTICE"
                  )
                }
                className="rounded bg-surface px-2 py-1 text-sm text-ink outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="DEMAND_NOTICE">Send a demand notice</option>
                <option value="DECLARE_DEFAULT">Declare default</option>
              </select>
              <button
                onClick={handleConsensusCheck}
                disabled={busy}
                className="text-sm text-ink-soft hover:text-accent disabled:opacity-60"
              >
                Check →
              </button>
            </div>
            {consensusResult ? (
              <p className="mt-3 text-sm text-ink-soft">
                {consensusResult.agreementReached
                  ? "Both providers agreed."
                  : "Providers disagreed —"}{" "}
                {consensusResult.requiresHumanReview
                  ? "this needs your review before acting."
                  : "no review needed."}
              </p>
            ) : null}
          </div>
        ) : null}

        {loan.status !== "REPAID" && loan.status !== "DEFAULTED" ? (
          <div className="py-5 first:pt-0">
            {showDisputeForm ? (
              <>
                <p className="text-sm text-ink-soft">Something&rsquo;s wrong:</p>
                <textarea
                  value={disputeReason}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md bg-surface px-3 py-2 text-ink outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handleDispute}
                    disabled={busy || disputeReason.trim().length < 10}
                    className="rounded-md bg-danger px-4 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-60"
                  >
                    Raise dispute
                  </button>
                  <button
                    onClick={() => setShowDisputeForm(false)}
                    className="text-sm text-ink-faint hover:text-ink-soft"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowDisputeForm(true)}
                className="text-sm text-ink-faint hover:text-danger"
              >
                Raise a dispute
              </button>
            )}
          </div>
        ) : null}
      </div>

      <h2 className="font-display mt-12 text-xl text-ink">Timeline</h2>
      {timeline === null ? (
        <p className="mt-4 text-ink-faint">Loading…</p>
      ) : timeline.length === 0 ? (
        <p className="mt-4 text-ink-faint">Nothing recorded yet.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {timeline.map((event, index) => (
            <div key={index} className="border-l-2 border-border pl-4">
              <p className="text-sm text-ink-faint">
                {new Date(event.occurredAt).toLocaleString()}
              </p>
              <p className="mt-1 text-ink">{event.summary}</p>
              <p className="mt-1 text-sm text-ink-soft">{event.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
