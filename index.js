import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"
import { Neo4jGraphQL } from "@neo4j/graphql"
import neo4j from "neo4j-driver"

const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "password")
)

const typeDefs = `#graphql
  type User {
    id: ID!
    posts: [Post] @customResolver(requires: "id")
  }

  type Post @authorization(filter: [{ where: { node: { author: { id: "$jwt.sub" } } } } ]) {
    title: String!
    content: String!
    author: User! @relationship(type: "AUTHORED", direction: IN)
  }
`

const resolvers = {
  User: {
    posts: async (parent, params, context, info) => {
      const { id } = params
      return [{ title: "My Post", content: "Some content", author: { id: "some-user" } }]
    },
  },
}

const neoSchema = new Neo4jGraphQL({ typeDefs, driver, resolvers })
const server = new ApolloServer({ schema: await neoSchema.getSchema() })

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({ req, jwt: { sub: "some-user" } }),
  listen: { port: 4000 }
})

console.log(`Serving at ${url}`)
