import { GraphQLSchema } from "graphql"
import { SchemaComposer } from "graphql-compose"

import { createPageDependency } from "../redux/actions/add-page-dependency"

import { LocalNodeModel } from "./node-model"
import { defaultFieldResolver } from "./resolvers"
import { IGraphQLRunnerStats } from "../query/types"
import {
  IGatsbyResolverContext,
  IGraphQLSpanTracer,
  GatsbyGraphQLResolveInfo,
} from "./type-definitions"

import { store } from "../redux"
import {
  registerModule,
  generateModuleId,
} from "../redux/actions/modules/register-module"
import { addModuleDependencyToQueryResult } from "../redux/actions/internal"

export default function withResolverContext<TSource, TArgs>({
  schema,
  schemaComposer,
  context,
  customContext,
  nodeModel,
  stats,
  tracer,
  addDataProcessor,
}: {
  schema: GraphQLSchema
  schemaComposer: SchemaComposer<IGatsbyResolverContext<TSource, TArgs>>
  context?: Record<string, any>
  customContext?: Record<string, any>
  nodeModel?: any
  stats?: IGraphQLRunnerStats | null
  tracer?: IGraphQLSpanTracer
  addDataProcessor?: ({
    info: GatsbyGraphQLResolveInfo,
    processorSource: string,
  }) => void
}): IGatsbyResolverContext<TSource, TArgs> {
  const nodeStore = require(`../db/nodes`)

  if (!nodeModel) {
    nodeModel = new LocalNodeModel({
      nodeStore,
      schema,
      schemaComposer,
      createPageDependency,
    })
  }

  const addModuleDependency = ({ source, type = `default`, importName }) => {
    if (!context?.path) {
      return `that's like graphiql or gatsby-node - DOESNT WORK NOW`
    }

    // if (context.path.startsWith(`sq--`)) {
    //   return `static query - DOESNT WORK NOW`
    // }

    // TO-DO: validation

    // generate moduleID - this show too many details - will change in future
    const moduleID = generateModuleId({ source, type, importName })

    if (!store.getState().modules.has(moduleID)) {
      // register module
      store.dispatch(
        registerModule({
          source,
          type,
          importName,
        })
      )
    }

    store.dispatch(
      addModuleDependencyToQueryResult({
        path: context.path,
        moduleID,
      })
    )

    // actual working stuff
    return moduleID
  }

  if (!addDataProcessor) {
    addDataProcessor = function (): void {}
  }

  return {
    ...(context || {}),
    ...(customContext || {}),
    defaultFieldResolver,
    nodeModel: nodeModel.withContext({
      path: context ? context.path : undefined,
    }),
    stats: stats || null,
    tracer: tracer || null,
    pageModel: {
      // this is what Kyle suggests to be compliant with https://www.gatsbyjs.org/docs/api-specification/#operators
      setModule: addModuleDependency,
      // this is how I have this defined it my design doc
      addModule: addModuleDependency,
    },

    // WIP api shape - just so mdx/demos continue to work
    addModuleDependency,
    addDataProcessor,
  }
}

module.exports = withResolverContext
