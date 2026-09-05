import nodemailer from "nodemailer"

export type MailConfig = {
  host: string
  port: number
  user: string
  password: string
}

type SendEmailInput = {
  to: string
  subject: string
  html: string
}

export function createMailer(config: MailConfig) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    auth: {
      user: config.user,
      pass: config.password
    }
  })

  return async function sendEmail(input: SendEmailInput): Promise<void> {
    await transporter.sendMail({
      from: config.user,
      to: input.to,
      subject: input.subject,
      html: input.html
    })
  }
}
