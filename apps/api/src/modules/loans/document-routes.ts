import type {} from "@fastify/cookie"
import { database } from "@repo/database"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { env } from "../../env"
import { verifyAccessToken } from "../auth/jwt"
import { computeContentHash, generateDocumentPdf } from "./pdf"

const paramsSchema = z.object({
  loanId: z.string(),
  documentId: z.string()
})

export function registerDocumentRoutes(app: FastifyInstance): void {
  app.get(
    "/api/v1/loans/:loanId/documents/:documentId/pdf",
    async (request, reply) => {
      const { loanId, documentId } = paramsSchema.parse(request.params)

      const bearerToken = request.headers.authorization?.replace("Bearer ", "")
      const token = bearerToken ?? request.cookies.access_token

      if (!token) {
        return reply.status(401).send("Unauthorized")
      }

      const payload = await verifyAccessToken(
        token,
        env.JWT_ACCESS_SECRET
      ).catch(() => null)

      if (!payload) {
        return reply.status(401).send("Unauthorized")
      }

      const loan = await database.loan.findUnique({ where: { id: loanId } })

      if (!loan) {
        return reply.status(404).send("Loan not found")
      }

      if (
        loan.lenderId !== payload.userId &&
        loan.borrowerId !== payload.userId
      ) {
        return reply.status(403).send("You are not a party to this loan")
      }

      const document = await database.document.findUnique({
        where: { id: documentId }
      })

      if (!document || document.loanId !== loanId) {
        return reply.status(404).send("Document not found")
      }

      const recomputedHash = computeContentHash(document.content)

      if (recomputedHash !== document.contentHash) {
        return reply
          .status(409)
          .send("Document content hash mismatch - integrity check failed")
      }

      const pdfBytes = await generateDocumentPdf(document.content, {
        type: document.type,
        createdAt: document.createdAt,
        contentHash: document.contentHash
      })

      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${document.type.toLowerCase()}-${document.id}.pdf"`
        )
        .send(Buffer.from(pdfBytes))
    }
  )
}
