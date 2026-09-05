import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockPush, mockLogin } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockLogin: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush })
}))

vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      login: mockLogin
    }
  }
}))

import LoginPage from "./page"

describe("LoginPage", () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockLogin.mockClear()
  })

  it("renders the essential fields and actions", () => {
    render(<LoginPage />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /create an account/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /continue with google/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /continue with github/i })
    ).toBeInTheDocument()
  })

  it("shows a validation error and never calls the API on an empty submit", async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole("button", { name: /sign in/i }))

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it("calls the API with the entered credentials and redirects on success", async () => {
    mockLogin.mockResolvedValueOnce({ userId: "user_1" })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), "person@example.com")
    await user.type(screen.getByLabelText(/password/i), "longEnough1")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: "person@example.com",
        password: "longEnough1"
      })
    )
    expect(mockPush).toHaveBeenCalledWith("/dashboard")
  })
})
