import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/client/index"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const adapter = new PrismaPg({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

export const database = new PrismaClient({ adapter })

export * from "../generated/client/index"
