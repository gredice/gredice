/* eslint-disable */

import * as sdk from "hypertune";

export const queryId = "2adc51a7-dda3-5349-97b4-f1db67cd00e8";

export const query: sdk.Query<sdk.ObjectValueWithVariables> = {"variableDefinitions":{},"fragmentDefinitions":{},"fieldQuery":{"Query":{"type":"InlineFragment","objectTypeName":"Query","selection":{"root":{"fieldArguments":{"__isPartialObject__":true},"fieldQuery":{"Root":{"type":"InlineFragment","objectTypeName":"Root","selection":{"socialLogin":{"fieldArguments":{},"fieldQuery":null},"allowAddToCart":{"fieldArguments":{},"fieldQuery":null},"allowRaisedBedSelection":{"fieldArguments":{},"fieldQuery":null},"enableDebugCloseup":{"fieldArguments":{},"fieldQuery":null},"shoppingCart":{"fieldArguments":{},"fieldQuery":null},"enableDebugHud":{"fieldArguments":{},"fieldQuery":null}}}}}}}}};

export const initData = {"commitId":30648,"hash":"2469266828047351","reducedExpression":{"id":"hSzx_K7sNYI77jRriD4U1","logs":{},"type":"ObjectExpression","fields":{"root":{"id":"sAbJTW3LHNEltLHB8AA4n","body":{"id":"8qdt_QWcSqIYYFTe-_aA0","logs":{},"type":"ObjectExpression","fields":{"socialLogin":{"id":"cu92xXcdB2Ew4XLDvuKLp","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"utdts61I0gAhp2PJ778jF":1}}},"allowAddToCart":{"id":"9MlflO6eX1lk7m2CG8jz3","type":"SwitchExpression","cases":[{"id":"geLFOhQmjoq3ADg9wf1WI","when":{"a":{"id":"H0mZa3D4Ekzv7DdQ3Fg0y","type":"GetFieldExpression","object":{"id":"d8U9dZPynX9OvAwkOWlbm","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > user > email","valueType":{"type":"StringValueType"}},"b":{"id":"pMP_JOYm8oj3HWkxKO7ck","type":"ListExpression","items":[{"id":"dLQSKEZNVLCmXl1yG06Sr","type":"StringExpression","value":"aleksandar.toplek+testemail@gmail.com","valueType":{"type":"StringValueType"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"StringValueType"}}},"id":"8k0yIr2FVkX5yHsPSdL7X","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"then":{"id":"h9pB7v9lSyhZDQehvC2kJ","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}}],"control":{"id":"x7oHBjS3yFuOjrGUr98_c","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"default":{"id":"sSgLZXpjD-ddtLnc1BCSG","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"is1fRh3HtB1DBxnaxGNYR":1}}},"allowRaisedBedSelection":{"id":"QU2vOkjePObgyerpo241K","type":"SwitchExpression","cases":[{"id":"cKf6-gILNcq16Vc7ckOr0","when":{"a":{"id":"QBHCEShpmu6UU8hEhWTdh","type":"GetFieldExpression","object":{"id":"yzFrR1uHY70AUbS03Hfv_","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > user > email","valueType":{"type":"StringValueType"}},"b":{"id":"3eFcnEjA0RnByJiR6MTaD","type":"ListExpression","items":[{"id":"ecolNm8ZipDFsL9mlRaDq","type":"StringExpression","value":"aleksandar.toplek+testemail@gmail.com","valueType":{"type":"StringValueType"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"StringValueType"}}},"id":"HfG3MpsLe_yKSdIgNe4gd","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"then":{"id":"PApmztUq9QmoDHsWKix4C","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}}],"control":{"id":"1TSSAMAcIGIhxCtewDJ4w","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"default":{"id":"j4lijTFPq_LLpnU4SFaWH","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"_fg3IGX5HUoNFCnQnWIqT":1}}},"enableDebugCloseup":{"id":"mIXrvVwY4U5YQ3O59T0j6","type":"SwitchExpression","cases":[{"id":"GWDeNaXeGYXMABwxBOomu","when":{"a":{"id":"tG6ZGpHBtnxEG9NH1OQiq","type":"GetFieldExpression","object":{"id":"LX0CM9QauTMAGSEeJUDLq","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > environment","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}},"b":{"id":"GtTCVjIj8jVeOxDTRwgSX","type":"ListExpression","items":[{"id":"BCnWob9dYRFfhatS02Xl_","type":"EnumExpression","value":"development","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"EnumValueType","enumTypeName":"Environment"}}},"id":"fb9TE3Yb7NPrHsUzsCYxy","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"then":{"id":"YLIqLryynNv9QRR9C_aRo","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}}],"control":{"id":"QFB3U9FDNc3w6aWW9XwPN","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"default":{"id":"1TXYDm782KoLc85_O7sNF","type":"BooleanExpression","value":false,"valueType":{"type":"BooleanValueType"}},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"J5D2Ud8BFP5uvl2WQp9Ie":1}}},"shoppingCart":{"id":"2LzRqBun6uOKG5TD8PwEp","type":"SwitchExpression","cases":[{"id":"-toQo7vtvAn8wxbxlqq-3","when":{"a":{"id":"ikwGgW4iuvdeMLne27U-q","type":"GetFieldExpression","object":{"id":"OeLfpKCeQGQjVqCVsO39i","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > environment","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}},"b":{"id":"OUC-COwqurU8gqdTwCfSs","type":"ListExpression","items":[{"id":"mAJH3WOCxEP9E1j74Yklz","type":"EnumExpression","value":"development","valueType":{"type":"EnumValueType","enumTypeName":"Environment"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"EnumValueType","enumTypeName":"Environment"}}},"id":"wgn6kbnCnPL7FXmgXgcgg","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"then":{"id":"5evyivgkSOR7DM_7-9T-B","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}},{"id":"fsabERVBFvp9ruDhNlpsy","when":{"a":{"id":"zeRHM9Ii76IgItxPcsxIn","type":"GetFieldExpression","object":{"id":"BR3mvCQzxhgaAer0pEf5J","type":"VariableExpression","valueType":{"type":"ObjectValueType","objectTypeName":"Query_root_args"},"variableId":"BZ17_qmFfcyqAuDSTOPbH"},"fieldPath":"context > user > email","valueType":{"type":"StringValueType"}},"b":{"id":"p4NTXLjUN5vMzkO2P49CO","type":"ListExpression","items":[{"id":"twSawIgMp1keseTbFeL7G","type":"StringExpression","value":"aleksandar.toplek+testemail@gmail.com","valueType":{"type":"StringValueType"}}],"valueType":{"type":"ListValueType","itemValueType":{"type":"StringValueType"}}},"id":"dzwRMukmN9_kpIWvmp4J7","type":"ComparisonExpression","operator":"in","valueType":{"type":"BooleanValueType"}},"then":{"id":"ahCZT5s4xCqxAWnz8qQ0T","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}}}],"control":{"id":"oqDDAUxxqTDTe88_Z0kvp","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"default":{"id":"oU1qNF45pf8zYxXQfjC5v","type":"BooleanExpression","value":true,"valueType":{"type":"BooleanValueType"}},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"SAlh8nV-RpCdprS8YAUsI":1}}},"enableDebugHud":{"id":"eBU-zMgJe6dO6jTG4feRf","type":"BooleanExpression","value":false,"metadata":{"note":""},"valueType":{"type":"BooleanValueType"},"logs":{"evaluations":{"HC9HIJsBk_0LEh72su_AH":1}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Root"},"objectTypeName":"Root"},"logs":{},"type":"FunctionExpression","valueType":{"type":"FunctionValueType","returnValueType":{"type":"ObjectValueType","objectTypeName":"Root"},"parameterValueTypes":[{"type":"ObjectValueType","objectTypeName":"Query_root_args"}]},"parameters":[{"id":"BZ17_qmFfcyqAuDSTOPbH","name":"rootArgs"}]}},"metadata":{"permissions":{"user":{},"group":{"team":{"write":"allow"}}}},"valueType":{"type":"ObjectValueType","objectTypeName":"Query"},"objectTypeName":"Query"},"splits":{},"commitConfig":{"splitConfig":{}}}


export const vercelFlagDefinitions = {"socialLogin":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EsocialLogin"},"allowAddToCart":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EallowAddToCart"},"allowRaisedBedSelection":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EallowRaisedBedSelection"},"enableDebugCloseup":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EenableDebugCloseup"},"shoppingCart":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EshoppingCart"},"enableDebugHud":{"options":[{"label":"Off","value":false},{"label":"On","value":true}],"origin":"https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EenableDebugHud"}};

export type RootFlagValues = {
  "socialLogin": boolean;
  "allowAddToCart": boolean;
  "allowRaisedBedSelection": boolean;
  "enableDebugCloseup": boolean;
  "shoppingCart": boolean;
  "enableDebugHud": boolean;
}

export type FlagValues = {
  "socialLogin": boolean;
  "allowAddToCart": boolean;
  "allowRaisedBedSelection": boolean;
  "enableDebugCloseup": boolean;
  "shoppingCart": boolean;
  "enableDebugHud": boolean;
}

export type FlagPaths = keyof FlagValues & string;

export const flagFallbacks: FlagValues = {
  "socialLogin": false,
  "allowAddToCart": false,
  "allowRaisedBedSelection": false,
  "enableDebugCloseup": false,
  "shoppingCart": false,
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
  socialLogin: boolean;
  allowAddToCart: boolean;
  allowRaisedBedSelection: boolean;
  enableDebugCloseup: boolean;
  shoppingCart: boolean;
  enableDebugHud: boolean;
}

const rootFallback = {socialLogin:false,allowAddToCart:false,allowRaisedBedSelection:false,enableDebugCloseup:false,shoppingCart:false,enableDebugHud:false};

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
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EsocialLogin})
   */
  socialLogin({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("socialLogin", { fieldArguments: args });
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
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EallowAddToCart})
   */
  allowAddToCart({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("allowAddToCart", { fieldArguments: args });
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
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EallowRaisedBedSelection})
   */
  allowRaisedBedSelection({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("allowRaisedBedSelection", { fieldArguments: args });
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
   * [Open in Hypertune UI]({@link https://app.hypertune.com/projects/4087/main/draft/logic?selected_field_path=root%3EshoppingCart})
   */
  shoppingCart({ args = {}, fallback }: { args?: EmptyObject; fallback: boolean; }): boolean {
    const props0 = this.getFieldNodeProps("shoppingCart", { fieldArguments: args });
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

const sourceFallback = {root:{socialLogin:false,allowAddToCart:false,allowRaisedBedSelection:false,enableDebugCloseup:false,shoppingCart:false,enableDebugHud:false}};

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
    queryId,
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
