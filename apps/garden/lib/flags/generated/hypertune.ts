/* eslint-disable */

import * as sdk from "hypertune";

export const queryCode = `query FullQuery{root{enableDebugHud}}`;

export const query: sdk.Query<sdk.ObjectValueWithVariables> = {"variableDefinitions":{},"fragmentDefinitions":{},"fieldQuery":{"Query":{"type":"InlineFragment","objectTypeName":"Query","selection":{"root":{"fieldArguments":{"__isPartialObject__":true},"fieldQuery":{"Root":{"type":"InlineFragment","objectTypeName":"Root","selection":{"enableDebugHud":{"fieldArguments":{},"fieldQuery":null}}}}}}}}};

export const initData = {"commitId":24474,"hash":"3076875996853314","reducedExpression":{"id":"hSzx_K7sNYI77jRriD4U1","logs":{},"type":"ObjectExpression","fields":{"root":{"id":"sAbJTW3LHNEltLHB8AA4n","body":{"id":"8qdt_QWcSqIYYFTe-_aA0","logs":{},"type":"ObjectExpression","fields":{"enableDebugHud":{"id":"Mtmi1IYM6njIsW8GtY_nz","type":"SwitchExpression","cases":[{"id":"QMRGlwOYR8ftLC5PaYv3f","when":{"a":{"id":"CFPf03mL_IrYeVqDCFkFX","type":"GetFieldExpression","object":{"id":"0XtUBFH9kcSr2JpUboBAO","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > environment","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}},"b":{"id":"m6CkH8xPniVBY7xaeYiY4","type":"ListExpression","items":[{"id":"W5YSdKM0LaQD1iFaj49Ts","type":"EnumExpression","value":"development","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"EnumValueType","enumTypeName":"Environment"}}},"id":"jxrczTLb4JoCDS92YkatR","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"then":{"id":"o2yTJWspoeGw-lrTFAQJI","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}},{"id":"eIZRk4f_PCOj1rUwMuqMQ","when":{"a":{"a":{"id":"lQeoesytUjVq3DDCyXyHX","type":"GetFieldExpression","object":{"id":"tJDLqomHNZaLXMoumZSlZ","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > environment","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}},"b":{"id":"3rMfzeKlYUU_MdNC4bnIv","type":"ListExpression","items":[{"id":"TGlOdrgXL7553ccDC4ggR","type":"EnumExpression","value":"production","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"EnumValueType","enumTypeName":"Environment"}}},"id":"6FM0egS3mmxRk4C8oPHDo","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"b":{"a":{"id":"mGG481o8fvN8jso-9YU94","type":"GetFieldExpression","object":{"id":"nXKEKD2KkcH6NH0pF3-PX","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > user > email","valueType":{"type":"StringValueType"}},"b":{"id":"ddwPJTJ8xXp4wxv4UgGQI","type":"ListExpression","items":[{"id":"DIdDu39oozQegfjYbFCT6","type":"StringExpression","value":"aleksandar.toplek@gredice.com","valueType":{"type":"StringValueType"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"StringValueType"}}},"id":"Tpj8MIBI5-EW14nUVx9PL","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"id":"9gW-tD1AAnqpPcijo4bog","type":"ComparisonExpression","operator":"AND","valueType":{"type":"BooleanValueType"}},"then":{"id":"3tjur13HpM_9LhX9HAzpZ","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}}],"control":{"id":"Udb-DvT4n56Sy1UP6H-qC","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"default":{"id":"eBU-zMgJe6dO6jTG4feRf","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"}},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"HC9HIJsBk_0LEh72su_AH":1}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Root"},"objectTypeName":"Root"},"logs":{},"type":"FunctionExpression","valueType":{"type":"FunctionValueType","returnValueType":{"type":"ObjectValueType","objectTypeName":"Root"},"parameterValueTypes":[{"type":"ObjectValueType","objectTypeName":"Query_root_args"}]},"parameters":[{"id":"BZ17_qmFfcyqAuDSTOPbH","name":"rootArgs"}]}},"metadata":{"permissions":{"user":{},"group":{"team":{"write":"allow"}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Query"},"objectTypeName":"Query"},"splits":{},"commitConfig":{"splitConfig":{}}}


export const vercelFlagDefinitions = {"enableDebugHud":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EenableDebugHud"}};

export type FlagValues = {
  "enableDebugHud": boolean;
}

export type AllFlagValues = {
  "enableDebugHud": boolean;
}

export type FlagPaths = keyof FlagValues & string;

export const flagFallbacks: FlagValues = {
  "enableDebugHud": false,
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
  enableDebugHud: boolean;
}

const rootFallback = {enableDebugHud:false};

export class RootNode extends sdk.Node {
  override typeName = "Root" as const;

  getRootArgs(): RootArgs {
    const { step } = this.props;
    return (step?.type === 'GetFieldStep' ? step.fieldArguments : {}) as RootArgs;
  }

  get({ fallback = rootFallback as Root}: { fallback?: Root } = {}): Root {
    const getQuery = null;
    return this.getValue({ query: getQuery, fallback }) as Root;
  }

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EenableDebugHud})
   */
  enableDebugHud({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("enableDebugHud", { fieldArguments: args });
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

const sourceFallback = {root:{enableDebugHud:false}};

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
export type CreateSourceOptions = { 
  token: string; 
  variableValues?: VariableValues;
  override?: sdk.DeepPartial<Source> | null;
} & sdk.CreateOptions

export function createSource({
  token,
  variableValues = {},
  override,
  ...options
}: CreateSourceOptions): SourceNode {
  return sdk.create({
    NodeConstructor: SourceNode,
    token,
    query,
    queryCode,
    variableValues,
    override,
    options: {initData: initData as unknown as sdk.InitData, ...options },
  });
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
  ...options
}: CreateSourceOptions): SourceNode {
  return typeof window === "undefined"
    ? createSource({ token, variableValues, override, ...options })
    : emptySource;
}

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
