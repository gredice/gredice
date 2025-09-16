/* eslint-disable */

import * as sdk from "hypertune";

export const queryId = "c6423090-78aa-57e0-ae5f-afe6ad3bc456";

export const query: sdk.Query<sdk.ObjectValueWithVariables> = {"variableDefinitions":{},"fragmentDefinitions":{},"fieldQuery":{"Query":{"type":"InlineFragment","objectTypeName":"Query","selection":{"root":{"fieldArguments":{"__isPartialObject__":true},"fieldQuery":{"Root":{"type":"InlineFragment","objectTypeName":"Root","selection":{"raisedBedFieldWatering":{"fieldArguments":{},"fieldQuery":null},"raisedBedDiary":{"fieldArguments":{},"fieldQuery":null},"raisedBedFieldDiary":{"fieldArguments":{},"fieldQuery":null},"raisedBedFieldOperations":{"fieldArguments":{},"fieldQuery":null},"raisedBedOperations":{"fieldArguments":{},"fieldQuery":null},"raisedBedWatering":{"fieldArguments":{},"fieldQuery":null},"enableDebugCloseup":{"fieldArguments":{},"fieldQuery":null},"enableDebugHud":{"fieldArguments":{},"fieldQuery":null}}}}}}}}};

export const initData = {"commitId":31642,"hash":"6161187454489082","reducedExpression":{"id":"hSzx_K7sNYI77jRriD4U1","logs":{},"type":"ObjectExpression","fields":{"root":{"id":"sAbJTW3LHNEltLHB8AA4n","body":{"id":"8qdt_QWcSqIYYFTe-_aA0","logs":{},"type":"ObjectExpression","fields":{"raisedBedFieldWatering":{"id":"cf9fO3I7fWyzED3SveFe7","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"9MIAOeqKCIcYD2lCiNpbF":1}}},"raisedBedDiary":{"id":"rd5BJYsXeTxE2Nn6iuhM4","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"-4sgSvnjKNvH9oG5f18Z_":1}}},"raisedBedFieldDiary":{"id":"38J0e2G3QculRXp9Hw5OD","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"-I8tt4MRtaoBLXTp_rXHT":1}}},"raisedBedFieldOperations":{"id":"x5UKEyX5M4Yt-1g_iqLQC","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"kUW4GeEVanIkaGrxr8jQ0":1}}},"raisedBedOperations":{"id":"XOVdIFtA99gMzH1j4gbK4","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"G6yYeQn2ZHufeV9bcJrEK":1}}},"raisedBedWatering":{"id":"8B2CgD_jIlSaX_c_am2As","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"f9nkv0-ALCIdEk7FqmLfl":1}}},"enableDebugCloseup":{"id":"1TXYDm782KoLc85_O7sNF","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"J5D2Ud8BFP5uvl2WQp9Ie":1}}},"enableDebugHud":{"id":"eBU-zMgJe6dO6jTG4feRf","type":"BooleanExpression","value":false,"metadata":{"note":""},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"HC9HIJsBk_0LEh72su_AH":1}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Root"},"objectTypeName":"Root"},"logs":{},"type":"FunctionExpression","valueType":{"type":"FunctionValueType","returnValueType":{"type":"ObjectValueType","objectTypeName":"Root"},"parameterValueTypes":[{"type":"ObjectValueType","objectTypeName":"Query_root_args"}]},"parameters":[{"id":"BZ17_qmFfcyqAuDSTOPbH","name":"rootArgs"}]}},"metadata":{"permissions":{"user":{},"group":{"team":{"write":"allow"}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Query"},"objectTypeName":"Query"},"splits":{},"commitConfig":{"splitConfig":{}}}


export const vercelFlagDefinitions = {"raisedBedFieldWatering":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedFieldWatering"},"raisedBedDiary":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedDiary"},"raisedBedFieldDiary":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedFieldDiary"},"raisedBedFieldOperations":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedFieldOperations"},"raisedBedOperations":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedOperations"},"raisedBedWatering":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedWatering"},"enableDebugCloseup":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EenableDebugCloseup"},"enableDebugHud":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EenableDebugHud"}};

export type FlagValues = {
  "raisedBedFieldWatering": boolean;
  "raisedBedDiary": boolean;
  "raisedBedFieldDiary": boolean;
  "raisedBedFieldOperations": boolean;
  "raisedBedOperations": boolean;
  "raisedBedWatering": boolean;
  "enableDebugCloseup": boolean;
  "enableDebugHud": boolean;
}

export type FlagPath = keyof FlagValues & string;

export const flagFallbacks: FlagValues = {
  "raisedBedFieldWatering": false,
  "raisedBedDiary": false,
  "raisedBedFieldDiary": false,
  "raisedBedFieldOperations": false,
  "raisedBedOperations": false,
  "raisedBedWatering": false,
  "enableDebugCloseup": false,
  "enableDebugHud": false,
}

export function decodeFlagValues<TFlagPath extends keyof FlagValues & string>(
  encodedFlagValues: string,
  flagPaths: TFlagPath[]
): Pick<FlagValues, TFlagPath> {
  return sdk.decodeFlagValues({ encodedFlagValues, flagPaths })
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
  raisedBedFieldWatering: boolean;
  raisedBedDiary: boolean;
  raisedBedFieldDiary: boolean;
  raisedBedFieldOperations: boolean;
  raisedBedOperations: boolean;
  raisedBedWatering: boolean;
  enableDebugCloseup: boolean;
  enableDebugHud: boolean;
}

const rootFallback = {raisedBedFieldWatering:false,raisedBedDiary:false,raisedBedFieldDiary:false,raisedBedFieldOperations:false,raisedBedOperations:false,raisedBedWatering:false,enableDebugCloseup:false,enableDebugHud:false};

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
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedFieldWatering})
   */
  raisedBedFieldWatering({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("raisedBedFieldWatering", { fieldArguments: args });
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

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedDiary})
   */
  raisedBedDiary({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("raisedBedDiary", { fieldArguments: args });
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

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedFieldDiary})
   */
  raisedBedFieldDiary({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("raisedBedFieldDiary", { fieldArguments: args });
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

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedFieldOperations})
   */
  raisedBedFieldOperations({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("raisedBedFieldOperations", { fieldArguments: args });
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

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedOperations})
   */
  raisedBedOperations({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("raisedBedOperations", { fieldArguments: args });
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

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EraisedBedWatering})
   */
  raisedBedWatering({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("raisedBedWatering", { fieldArguments: args });
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

  /**
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EenableDebugCloseup})
   */
  enableDebugCloseup({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("enableDebugCloseup", { fieldArguments: args });
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

const sourceFallback = {root:{raisedBedFieldWatering:false,raisedBedDiary:false,raisedBedFieldDiary:false,raisedBedFieldOperations:false,raisedBedOperations:false,raisedBedWatering:false,enableDebugCloseup:false,enableDebugHud:false}};

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
