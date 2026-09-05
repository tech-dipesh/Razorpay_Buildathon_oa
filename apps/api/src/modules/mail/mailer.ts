import { createMailer } from "@repo/mail"
import { env } from "../../env"

export const sendEmail = createMailer({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  user: env.SMTP_USER,
  password: env.SMTP_PASSWORD
})
