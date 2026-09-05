"use client"

import { createLoanInputSchema } from "@repo/shared"
import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { api } from "@/lib/api"

const inlineInputClass =
  "inline-block rounded bg-surface px-2 py-0.5 text-ink outline-none focus:ring-1 focus:ring-accent"
const detailInputClass =
  "rounded bg-surface-sunken/60 px-2 py-1 text-sm text-ink outline-none focus:ring-1 focus:ring-accent"

export default function NewLoanPage() {
  const router = useRouter()
  const [borrowerEmail, setBorrowerEmail] = useState("")
  const [principalAmount, setPrincipalAmount] = useState("")
  const [interestRate, setInterestRate] = useState("0")
  const [dueDate, setDueDate] = useState("")
  const [compoundingFrequency, setCompoundingFrequency] = useState("MONTHLY")
  const [repaymentType, setRepaymentType] = useState("LUMP_SUM")
  const [tenureMonths, setTenureMonths] = useState("")
  const [relationship, setRelationship] = useState("")
  const [maxSteps, setMaxSteps] = useState("4")
  const [cooldownHours, setCooldownHours] = useState("72")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!dueDate) {
      setError("Choose a due date.")
      return
    }

    const parsed = createLoanInputSchema.safeParse({
      borrowerEmail,
      principalAmount: Number(principalAmount),
      interestRate: Number(interestRate),
      compoundingFrequency,
      repaymentType,
      tenureMonths: Number(tenureMonths),
      dueDate: new Date(dueDate).toISOString(),
      relationship: relationship || undefined,
      maxSteps: Number(maxSteps),
      cooldownHours: Number(cooldownHours)
    })

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Check the details you entered."
      )
      return
    }

    setSubmitting(true)

    try {
      const result = await api.loans.create(parsed.data)
      router.push(`/loans/${result.loanId}`)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Couldn't create the loan. Try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Start a loan</h1>
      <p className="mt-2 text-ink-soft">
        Write it the way you&rsquo;d actually say it — they&rsquo;ll get a
        request to confirm it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-8">
        <p className="font-display max-w-xl text-2xl leading-loose text-ink">
          I&rsquo;m lending{" "}
          <input
            type="number"
            min="1"
            aria-label="Amount in rupees"
            value={principalAmount}
            onChange={(event) => setPrincipalAmount(event.target.value)}
            placeholder="amount"
            className={`${inlineInputClass} tabular-figure w-28 text-ink-soft`}
          />{" "}
          to{" "}
          <input
            type="email"
            aria-label="Borrower's email"
            value={borrowerEmail}
            onChange={(event) => setBorrowerEmail(event.target.value)}
            placeholder="their email"
            className={`${inlineInputClass} w-52`}
          />
          , at{" "}
          <input
            type="number"
            min="0"
            step="0.1"
            aria-label="Interest rate percent"
            value={interestRate}
            onChange={(event) => setInterestRate(event.target.value)}
            className={`${inlineInputClass} tabular-figure w-16 text-ink-soft`}
          />
          % interest, to be repaid by{" "}
          <input
            type="date"
            aria-label="Due date"
            value={dueDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(event) => setDueDate(event.target.value)}
            className={`${inlineInputClass} w-44`}
          />
          .
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-border pt-6 text-sm text-ink-soft">
          <input
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            placeholder="how you know them"
            className={detailInputClass}
          />
          <span className="text-ink-faint">·</span>
          <select
            value={repaymentType}
            onChange={(event) => setRepaymentType(event.target.value)}
            className={detailInputClass}
          >
            <option value="LUMP_SUM">Lump sum</option>
            <option value="INSTALLMENTS">Installments</option>
          </select>
          <select
            value={compoundingFrequency}
            onChange={(event) => setCompoundingFrequency(event.target.value)}
            className={detailInputClass}
          >
            <option value="MONTHLY">Compounds monthly</option>
            <option value="QUARTERLY">Compounds quarterly</option>
            <option value="ANNUALLY">Compounds annually</option>
          </select>
          <input
            type="number"
            min="1"
            aria-label="Tenure in months"
            value={tenureMonths}
            onChange={(event) => setTenureMonths(event.target.value)}
            placeholder="months"
            className={`${detailInputClass} w-20`}
          />
          <span className="text-ink-faint">·</span>
          <span>up to</span>
          <input
            type="number"
            min="1"
            max="6"
            aria-label="Maximum reminders"
            value={maxSteps}
            onChange={(event) => setMaxSteps(event.target.value)}
            className={`${detailInputClass} w-14`}
          />
          <span>reminders,</span>
          <input
            type="number"
            min="24"
            aria-label="Hours between reminders"
            value={cooldownHours}
            onChange={(event) => setCooldownHours(event.target.value)}
            className={`${detailInputClass} w-16`}
          />
          <span>h apart</span>
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send loan request"}
        </button>
      </form>
    </div>
  )
}
