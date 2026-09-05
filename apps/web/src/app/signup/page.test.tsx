import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSignup } = vi.hoisted(() => ({
  mockSignup: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      signup: mockSignup
    }
  }
}))

import SignupPage from "./page"

describe("SignupPage", () => {
  beforeEach(() => {
    mockSignup.mockClear()
  })

  it("renders name, email, optional phone, and password fields", () => {
    render(<SignupPage />)

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument()
  })

  it("shows a validation error and never calls the API on an empty submit", async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.click(screen.getByRole("button", { name: /create account/i }))

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(mockSignup).not.toHaveBeenCalled()
  })

  it("shows the check-your-email state after a successful signup, without a phone number", async () => {
    mockSignup.mockResolvedValueOnce({ userId: "user_1" })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/name/i), "Priya Sharma")
    await user.type(screen.getByLabelText(/email/i), "priya@example.com")
    await user.type(screen.getByLabelText(/password/i), "longEnough1")
    await user.click(screen.getByRole("button", { name: /create account/i }))

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(mockSignup).toHaveBeenCalledWith({
      name: "Priya Sharma",
      email: "priya@example.com",
      phone: undefined,
      password: "longEnough1"
    })
  })
})
