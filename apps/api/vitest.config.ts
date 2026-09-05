import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      API_BASE_URL: "http://localhost:4000",
      FRONTEND_URL: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters",
      JWT_ACCESS_TOKEN_TTL_MINUTES: "10",
      REFRESH_TOKEN_TTL_DAYS: "7",
      RAZORPAY_KEY_ID: "test-key-id",
      RAZORPAY_KEY_SECRET: "test-key-secret",
      RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
      SMTP_HOST: "localhost",
      SMTP_PORT: "587",
      SMTP_USER: "test@example.com",
      SMTP_PASSWORD: "test-password",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      GITHUB_CLIENT_ID: "test-github-client-id",
      GITHUB_CLIENT_SECRET: "test-github-client-secret"
    }
  }
})
