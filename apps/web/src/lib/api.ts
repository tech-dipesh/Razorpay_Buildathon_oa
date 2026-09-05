import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import type { AppRouter } from "@repo/api/router"

const link = new RPCLink({
  url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/rpc`,
  fetch: (request, init) =>
    globalThis.fetch(request, { ...init, credentials: "include" })
})

export const api: RouterClient<AppRouter> = createORPCClient(link)
