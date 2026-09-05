"use client"

import { loginInputSchema } from "@repo/shared"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { api } from "@/lib/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsed = loginInputSchema.safeParse({ email, password })

    if (!parsed.success) {
      setError("Enter a valid email and password.")
      return
    }

    setSubmitting(true)

    try {
      await api.auth.login(parsed.data)
      router.push("/dashboard")
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Couldn't sign in. Try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="font-display mb-10 text-lg text-ink">
        vaada
      </Link>

      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-2 text-ink-faint">
        Sign in to see your loans and promises.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
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
          <label htmlFor="password" className="text-sm text-ink-soft">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            placeholder="At least 10 characters"
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
          {submitting ? "Signing in…" : "Sign in"}
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
        New to vaada?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
