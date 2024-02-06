import { createServer } from "node:http"
import { createYoga } from "graphql-yoga"
import { Neo4jGraphQL } from "@neo4j/graphql"
import neo4j from "neo4j-driver"
import OGM from "@neo4j/graphql-ogm"

const DEBUG = false

const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "password")
)

const typeDefs = `#graphql
  type User {
    id: ID!
  }

  type Post @authorization(filter: [{ where: { node: { author: { id: "$jwt.sub" } } } } ]) {
    title: String!
    content: String!
    author: User! @relationship(type: "AUTHORED", direction: IN)
  }

  type Query {
    postById(id: ID!): Post
  }
`

let ogmCache
const getOGM = async () => {
  if (ogmCache != null) return ogmCache

  const ogm = new OGM.OGM({
    typeDefs,
    driver,
    resolvers,
    debug: DEBUG,
    features: { authorization: { verify: false, key: "" }},
  })

  await ogm.init()
  ogmCache = ogm
  return ogm
}

const resolvers = {
  Query: {
    postById: async (parent, params, context, info) => {
      const ogm = await getOGM()
      const Post = ogm.model("Post")

      const withContext = await Post.find({ context })
      const withoutContext = await Post.find()

      return null
    },
  },
}

await getOGM()

const neoSchema = new Neo4jGraphQL({
  typeDefs,
  driver,
  resolvers,
  debug: DEBUG,
  features: { authorization: { verify: false, key: "" }},
})

const yoga = createYoga({
  schema: await neoSchema.getSchema(),
  context: async (context) => ({ ...context, jwt: { sub: "some-user" } })
})

createServer(yoga).listen(4000, () => {
  console.info(`Server ready at localhost:4000`)
})
