/* eslint-disable */

import * as sdk from "hypertune";

export const queryCode = `query FullQuery{root{showUI}}`;

export const query: sdk.Query<sdk.ObjectValueWithVariables> = {"variableDefinitions":{},"fragmentDefinitions":{},"fieldQuery":{"Query":{"type":"InlineFragment","objectTypeName":"Query","selection":{"root":{"fieldArguments":{"__isPartialObject__":true},"fieldQuery":{"Root":{"type":"InlineFragment","objectTypeName":"Root","selection":{"showUI":{"fieldArguments":{},"fieldQuery":null}}}}}}}}};

export const initData = {"commitId":19212,"hash":"8763432039174089","reducedExpression":{"id":"DLtynSOOp0PagiOhQUw0f","logs":{},"type":"ObjectExpression","fields":{"root":{"id":"JY75eOxQTEzlV-A6Ni37v","body":{"id":"az-7S84s8S4CqbMMBi2z3","logs":{},"type":"ObjectExpression","fields":{"showUI":{"id":"0Z52N1oXb2apI6ZC_csP-","type":"SwitchExpression","cases":[{"id":"aHto_R5OkFsfhJiSmj0Za","when":{"a":{"id":"bW6KAK3IVzLXK7Wsggolw","type":"GetFieldExpression","object":{"id":"mnM9fr7nSlZ5pr1Ief6V0","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"CbT1XTBNkXnaDuUjpkURx"},"fieldPath":"context > environment","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}},"b":{"id":"lf8VUBWywLUJd6AfbSrs3","type":"ListExpression","items":[{"id":"_FudFyMhG9fIkMHp68RlO","type":"EnumExpression","value":"development","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}},{"id":"uQ70SQNZhGjQiawrl7kdo","type":"EnumExpression","value":"test","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"EnumValueType","enumTypeName":"Environment"}}},"id":"adZPQ08a0L80Gs43FGzWZ","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"then":{"id":"kAccljBkWAVpmRi-_O55D","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}}],"control":{"id":"f1ryfOsxx6_i9yN74QSlW","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"default":{"id":"B78l7-qHhFBZSvOn_ty9O","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"}},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"chgmSwThmZFMS-q0jyO_7":1}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Root"},"objectTypeName":"Root"},"logs":{},"type":"FunctionExpression","valueType":{"type":"FunctionValueType","returnValueType":{"type":"ObjectValueType","objectTypeName":"Root"},"parameterValueTypes":[{"type":"ObjectValueType","objectTypeName":"Query_root_args"}]},"parameters":[{"id":"CbT1XTBNkXnaDuUjpkURx","name":"rootArgs"}]}},"metadata":{"permissions":{"user":{},"group":{"team":{"write":"allow"}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Query"},"objectTypeName":"Query"},"splits":{},"commitConfig":{"splitConfig":{}}}


export const vercelFlagDefinitions = {"showUI":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4089/main/draft/logic?selected_field_path=root%3EshowUI"}};

export type RootFlagValues = {
  "showUI": boolean;
}

export type FlagValues = {
  "showUI": boolean;
}

export type FlagPaths = keyof FlagValues & string;

export const flagFallbacks: FlagValues = {
  "showUI": false,
}

export function decodeFlagValues<TFlagPaths extends keyof FlagValues & string>(
  encodedValues: string,
  flagPaths: TFlagPaths[]
): Pick<FlagValues, TFlagPaths> {
  return sdk.decodeFlagValues({ flagPaths, encodedValues })
}

export type VariableValues = {};

export type User = {
  id: string;
  name: string;
  email: string;
}

export const EnvironmentEnumValues = [
  "development",
  "production",
  "test"
] as const;
export type Environment = typeof EnvironmentEnumValues[number];

/**
 * This `Context` input type is used for the `context` argument on your root field.
 * It contains details of the current `user` and `environment`.
 * 
 * You can define other custom input types with fields that are primitives, enums 
 * or other input types.
 */
export type Context = {
  user: User;
  environment: Environment;
}

export type RootArgs = {
  context: Context;
}

export type EmptyObject = {};

export type Root = {
  showUI: boolean;
}

const rootFallback = {showUI:false};

export class RootNode extends sdk.Node {
  override typeName = "Root" as const;

  getRootArgs(): RootArgs {
    const { step } = this.props;
    return (step?.type === 'GetFieldStep' ? step.fieldArguments : {}) as RootArgs;
  }

  get({ fallback = rootFallback as Root}: { fallback?: Root } = {}): Root {
    const getQuery = sdk.mergeFieldQueryAndArgs(
      query.fragmentDefinitions,
      sdk.getFieldQueryForPath(query.fragmentDefinitions, query.fieldQuery, ["Query", "root"]), 
      null,
    );
    return this.getValue({ query: getQuery, fallback }) as Root;
  }

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4089/main/draft/logic?selected_field_path=root%3EshowUI})
   */
  showUI({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("showUI", { fieldArguments: args });
    const expression0 = props0.expression;

    if (
      expression0 &&
      expression0.type === "BooleanExpression"
    ) {
      const node = new sdk.BooleanNode(props0);
      return node.get({ fallback });
    }

    const node = new sdk.BooleanNode(props0);
    node._logUnexpectedTypeError();
    return node.get({ fallback });
  }
}

/**
 * This is your project schema expressed in GraphQL.
 * 
 * Define `Boolean` fields for feature flags, custom `enum` fields for flags with 
 * more than two states, `Int` fields for numeric flags like timeouts and limits, 
 * `String` fields to manage in-app copy, `Void` fields for analytics events, and 
 * fields with custom object and list types for more complex app configuration, 
 * e.g. to use Hypertune as a CMS.
 * 
 * Once you've changed your schema, set your flag logic in the Logic view.
 */
export type Source = {
  /**
   * You can add arguments to any field in your schema, which you can then use when
   * setting its logic, including the logic of any nested fields. Your root field 
   * already has a `context` argument. Since all flags are nested under the root 
   * field, this context will be available to all of them.
   */
  root: Root;
}

const sourceFallback = {root:{showUI:false}};

export type GetQueryRootArgs = {
  args: RootArgs;
}

export type GetQueryArgs = {
  root: GetQueryRootArgs;
}

/**
 * This is your project schema expressed in GraphQL.
 * 
 * Define `Boolean` fields for feature flags, custom `enum` fields for flags with 
 * more than two states, `Int` fields for numeric flags like timeouts and limits, 
 * `String` fields to manage in-app copy, `Void` fields for analytics events, and 
 * fields with custom object and list types for more complex app configuration, 
 * e.g. to use Hypertune as a CMS.
 * 
 * Once you've changed your schema, set your flag logic in the Logic view.
 */
export class SourceNode extends sdk.Node {
  override typeName = "Query" as const;

  get({ args, fallback = sourceFallback as Source}: { args: GetQueryArgs; fallback?: Source }): Source {
    const getQuery = sdk.mergeFieldQueryAndArgs(
      query.fragmentDefinitions,
      sdk.getFieldQueryForPath(query.fragmentDefinitions, query.fieldQuery, []), 
      args,
    );
    return this.getValue({ query: getQuery, fallback }) as Source;
  }

  /**
   * You can add arguments to any field in your schema, which you can then use when
   * setting its logic, including the logic of any nested fields. Your root field 
   * already has a `context` argument. Since all flags are nested under the root 
   * field, this context will be available to all of them.
   */
  root({ args }: { args: RootArgs; }): RootNode {
    const props0 = this.getFieldNodeProps("root", { fieldArguments: args });
    const expression0 = props0.expression;

    if (
      expression0 &&
      expression0.type === "ObjectExpression" &&
      expression0.objectTypeName === "Root"
    ) {
      return new RootNode(props0);
    }

    const node = new RootNode(props0);
    node._logUnexpectedTypeError();
    return node;
  }
}

export type DehydratedState = sdk.DehydratedState<Source, VariableValues>

const sources: { [key: string]: SourceNode } = {};

export type CreateSourceOptions = {
  token: string; 
  variableValues?: VariableValues;
  override?: sdk.DeepPartial<Source> | null;
  key?: string;
} & sdk.CreateOptions

export function createSource({
  token,
  variableValues = {},
  override,
  key,
  ...options
}: CreateSourceOptions): SourceNode {
  const sourceKey =
    key ?? (typeof window === "undefined" ? "server" : "client");

  if (!sources[sourceKey]) {
    sources[sourceKey] = sdk.create({
      NodeConstructor: SourceNode,
      token,
      variableValues,
      override,
      options: {initData: initData as unknown as sdk.InitData, ...options },
    });
  }

  return sources[sourceKey];
}

export const emptySource = new SourceNode({
  context: null,
  logger: null,
  parent: null,
  step: null,
  expression: null,
  initDataHash: null,
});

export function createSourceForServerOnly({
  token,
  variableValues = {},
  override,
  key,
  ...options
}: CreateSourceOptions): SourceNode {
  return typeof window === "undefined"
    ? createSource({ token, variableValues, override, ...options })
    : emptySource;
}

export const overrideCookieName = "hypertuneOverride";

/**
 * @deprecated use createSource instead.
 */
export const initHypertune = createSource
/**
 * @deprecated use SourceNode instead.
 */
export type QueryNode = SourceNode;
/**
 * @deprecated use Source instead.
 */
export type Query = Source;
