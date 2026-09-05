import { randomUUID } from "node:crypto"
import fastifyCookie from "@fastify/cookie"
import fastifyCors from "@fastify/cors"
import fastifyRateLimit from "@fastify/rate-limit"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fastify"
import { OpenAPIHandler } from "@orpc/openapi/fastify"
import { getRedisClient } from "@repo/redis"
import Fastify, { type FastifyInstance } from "fastify"
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from "fastify-type-provider-zod"
import { collectDefaultMetrics, register } from "prom-client"
import { env } from "./env"
import { registerDocumentRoutes } from "./modules/loans/document-routes"
import { registerWebhookRoutes } from "./modules/loans/webhook-routes"
import { registerOAuthRoutes } from "./modules/auth/oauth-routes"
import { router } from "./router"

collectDefaultMetrics()

const redis = getRedisClient(env.REDIS_URL)

const server = Fastify({
  logger: true,
  genReqId: () => randomUUID()
}).withTypeProvider<ZodTypeProvider>()

server.setValidatorCompiler(validatorCompiler)
server.setSerializerCompiler(serializerCompiler)

await server.register(fastifyCors, {
  origin: env.FRONTEND_URL,
  credentials: true
})
await server.register(fastifyCookie)
await server.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis
})

registerOAuthRoutes(server, redis)
registerDocumentRoutes(server)
registerWebhookRoutes(server, redis)

server.removeAllContentTypeParsers()
server.addContentTypeParser("*", (_request, _payload, done) => {
  done(null, undefined)
})

function mountVersionedApi(
  app: FastifyInstance,
  versionPrefix: `/${string}`
): void {
  const rpcHandler = new RPCHandler(router, {
    interceptors: [
      onError((error) => {
        app.log.error(error)
      })
    ]
  })

  const openApiHandler = new OpenAPIHandler(router, {
    interceptors: [
      onError((error) => {
        app.log.error(error)
      })
    ]
  })

  app.all(`${versionPrefix}/rpc/*`, async (request, reply) => {
    const { matched } = await rpcHandler.handle(request, reply, {
      prefix: `${versionPrefix}/rpc`,
      context: {
        authorizationHeader: request.headers.authorization,
        accessTokenCookie: request.cookies.access_token,
        refreshTokenCookie: request.cookies.refresh_token,
        requestId: request.id,
        reply
      }
    })

    if (!matched) {
      reply.status(404).send("Not found")
    }
  })

  app.all(`${versionPrefix}/*`, async (request, reply) => {
    const { matched } = await openApiHandler.handle(request, reply, {
      prefix: versionPrefix,
      context: {
        authorizationHeader: request.headers.authorization,
        accessTokenCookie: request.cookies.access_token,
        refreshTokenCookie: request.cookies.refresh_token,
        requestId: request.id,
        reply
      }
    })

    if (!matched) {
      reply.status(404).send("Not found")
    }
  })
}

mountVersionedApi(server, "/api/v1")

server.get("/health", async () => {
  return { status: "ok" }
})

server.get("/metrics", async (_request, reply) => {
  reply.header("Content-Type", register.contentType)
  return register.metrics()
})

server.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  server.log.error(error)
  process.exit(1)
})
