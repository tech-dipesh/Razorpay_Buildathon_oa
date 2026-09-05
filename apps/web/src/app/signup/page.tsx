"use client"

import { signupInputSchema } from "@repo/shared"
import Link from "next/link"
import { type FormEvent, useState } from "react"
import { api } from "@/lib/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsed = signupInputSchema.safeParse({
      name,
      email,
      phone: phone || undefined,
      password
    })

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Check the details you entered."
      )
      return
    }

    setSubmitting(true)

    try {
      await api.auth.signup(parsed.data)
      setSubmittedEmail(parsed.data.email)
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Couldn't create your account. Try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedEmail) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="font-display text-3xl text-ink">Check your email</h1>
        <p className="mt-3 text-ink-soft">
          We sent a link to <span className="text-ink">{submittedEmail}</span>.
          It expires in 5 minutes, so verify now if you can.
        </p>
        <Link
          href="/login"
          className="mt-8 text-sm text-accent hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="font-display mb-10 text-lg text-ink">
        vaada
      </Link>

      <h1 className="font-display text-3xl text-ink">Create an account</h1>
      <p className="mt-2 text-ink-faint">
        Start keeping a record of what you lend and borrow.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="text-sm text-ink-soft">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label htmlFor="email" className="text-sm text-ink-soft">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="phone" className="text-sm text-ink-soft">
            Phone <span className="text-ink-faint">(optional)</span>
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            placeholder="+91"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm text-ink-soft">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            placeholder="At least 10 characters, with a number"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-ink-faint">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={`${API_BASE_URL}/api/v1/auth/oauth/google/start`}
          className="rounded-md border border-border-strong px-4 py-2 text-center text-sm text-ink-soft hover:border-accent hover:text-accent"
        >
          Continue with Google
        </a>
        <a
          href={`${API_BASE_URL}/api/v1/auth/oauth/github/start`}
          className="rounded-md border border-border-strong px-4 py-2 text-center text-sm text-ink-soft hover:border-accent hover:text-accent"
        >
          Continue with GitHub
        </a>
      </div>

      <p className="mt-8 text-sm text-ink-faint">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
