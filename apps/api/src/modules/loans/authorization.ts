import { ORPCError } from "@orpc/server"
import { database } from "@repo/database"

export async function loadLoanForParty(loanId: string, userId: string) {
  const loan = await database.loan.findUnique({ where: { id: loanId } })

  if (!loan) {
    throw new ORPCError("NOT_FOUND", { message: "Loan not found" })
  }

  if (loan.lenderId !== userId && loan.borrowerId !== userId) {
    throw new ORPCError("FORBIDDEN", {
      message: "You are not a party to this loan"
    })
  }

  return loan
}

export async function loadLoanForLender(loanId: string, userId: string) {
  const loan = await loadLoanForParty(loanId, userId)

  if (loan.lenderId !== userId) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only the lender can perform this action"
    })
  }

  return loan
}

export async function loadLoanForBorrower(loanId: string, userId: string) {
  const loan = await loadLoanForParty(loanId, userId)

  if (loan.borrowerId !== userId) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only the borrower can perform this action"
    })
  }

  return loan
}
