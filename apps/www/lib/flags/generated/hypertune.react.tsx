/* eslint-disable */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as hypertune from "./hypertune";
import * as sdk from "hypertune";

// Hypertune

export function HypertuneProvider({
  createSourceOptions,
  dehydratedState,
  rootArgs,
  children,
}: {
  createSourceOptions: hypertune.CreateSourceOptions;
  dehydratedState?: hypertune.DehydratedState | null;
  rootArgs: hypertune.RootArgs;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <HypertuneSourceProvider
      createSourceOptions={{
        ...createSourceOptions,
        ...(dehydratedState ?? {}),
      }}
    >
      <HypertuneHydrator dehydratedState={dehydratedState}>
        <HypertuneRootProvider rootArgs={rootArgs}>
          {children}
        </HypertuneRootProvider>
      </HypertuneHydrator>
    </HypertuneSourceProvider>
  );
}

// Hypertune Source

const HypertuneSourceContext = React.createContext<{
  hypertuneSource: hypertune.SourceNode;
  setOverride: (newOverride: sdk.DeepPartial<hypertune.Source> | null) => void;
}>({
  hypertuneSource: hypertune.emptySource,
  setOverride: () => { /* noop */ },
});

export function HypertuneSourceProvider({
  createSourceOptions,
  children,
}: {
  createSourceOptions: hypertune.CreateSourceOptions;
  children: React.ReactNode;
}): React.ReactElement {
  const hypertuneSource = React.useMemo(
    () => {
      return hypertune.createSource({
        initDataProvider: typeof window === "undefined" ? null : undefined,
        remoteLogging: {
          mode: typeof window === "undefined" ? "off" : undefined,
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        localLogger: typeof window === "undefined" ? () => {} : undefined,
        ...createSourceOptions,
      });
    },
    // Don't recreate the source even if createSourceOptions changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [stateHash, setStateHash] = React.useState(
    hypertuneSource.getStateHash()
  );
  const router = useRouter();
  React.useEffect(() => {
    const updateListener: sdk.UpdateListener = (newStateHash, metadata) => {
      if (metadata.updateTrigger !== "initDataProvider") {
        return;
      }
      setStateHash(newStateHash); // Re-render

      if (!metadata.becameReady) {
        // Only refresh the page if the sdk was ready before this update
        router.refresh();
      }
    };
    hypertuneSource.addUpdateListener(updateListener);
    return () => {
      hypertuneSource.removeUpdateListener(updateListener);
    };
  }, [hypertuneSource, router]);

  const hypertuneSourceForStateHash = React.useMemo(() => {
    const { context } = hypertuneSource.props;
    const newProps = {
      ...hypertuneSource.props,
      stateHash,
      initDataHash: context?.initData?.hash ?? null,
      expression: context?.initData?.reducedExpression ?? null,
    };
    return new hypertune.SourceNode(newProps);
  }, [hypertuneSource, stateHash]);

  const setOverride = React.useCallback(
    (newOverride: sdk.DeepPartial<hypertune.Source> | null) => {
      setOverrideCookie(newOverride);
      router.refresh();
    },
    [router]
  );

  const value = React.useMemo(
    () => ({ hypertuneSource: hypertuneSourceForStateHash, setOverride }),
    [hypertuneSourceForStateHash, setOverride]
  );

  return (
    <HypertuneSourceContext.Provider value={value}>
      {children}
    </HypertuneSourceContext.Provider>
  );
}

export function useHypertuneSource(): hypertune.SourceNode {
  const { hypertuneSource } = React.useContext(HypertuneSourceContext);
  return hypertuneSource;
}

export function useSetOverride(): (newOverride: sdk.DeepPartial<hypertune.Source> | null) => void {
  const { setOverride } = React.useContext(HypertuneSourceContext);
  return setOverride;
}

// Hypertune Root

const HypertuneRootContext = React.createContext(
  new hypertune.RootNode({
    context: null,
    logger: null,
    parent: null,
    step: null,
    expression: null,
    initDataHash: null,
  })
);

export function HypertuneRootProvider({
  rootArgs,
  children,
}: {
  rootArgs: hypertune.RootArgs;
  children: React.ReactNode;
}): React.ReactElement {
  const hypertuneSource = useHypertuneSource();

  const hypertuneRoot = hypertuneSource.root({ args: rootArgs });

  return (
    <HypertuneRootContext.Provider value={hypertuneRoot}>
      {children}
    </HypertuneRootContext.Provider>
  );
}

export function useHypertune(): hypertune.RootNode {
  const hypertuneRoot = React.useContext(HypertuneRootContext);

  if (!hypertuneRoot.props.context) {
    console.warn(
      "[Hypertune] Calling `useHypertune` hook outside of the `HypertuneProvider`. Fallback values will be used."
    );
  }
  return hypertuneRoot;
}

export function HypertuneHydrator({
  dehydratedState,
  rootArgs,
  children,
}: {
  dehydratedState?: hypertune.DehydratedState | null;
  rootArgs?: hypertune.RootArgs;
  children: React.ReactElement | null;
}): React.ReactElement | null {
  const hypertuneSource = useHypertuneSource();

  if (dehydratedState) {
    hypertuneSource.hydrate(dehydratedState);
  }

  if (rootArgs) {
    return (
      <HypertuneRootProvider rootArgs={rootArgs}>
        {children}
      </HypertuneRootProvider>
    );
  }

  return children;
}

export function HypertuneClientLogger({
  flagPaths,
}: {
  flagPaths: hypertune.FlagPaths[];
}): null {
  const hypertuneRoot = useHypertune();
  const isReady = hypertuneRoot.isReady();

  React.useEffect(() => {
    if (!isReady) {
      return;
    }
    hypertuneRoot.getFlagValues({
      flagFallbacks: hypertune.flagFallbacks,
      flagPaths,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return null;
}

export const overrideCookieName = "hypertuneOverride";

function setOverrideCookie(newOverride: any): void {
  const d = new Date();
  d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  let expires = "expires=" + d.toUTCString();

  document.cookie = `${overrideCookieName}=${JSON.stringify(newOverride)};${expires};path=/`;
}
