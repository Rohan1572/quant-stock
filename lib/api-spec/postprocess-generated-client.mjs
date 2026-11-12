import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedClientPath = path.resolve(
  process.cwd(),
  "../api-client-react/src/generated/api.ts",
);
const generatedClient = await readFile(generatedClientPath, "utf8");
const unfilteredType =
  "type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];";
const filteredType =
  "type SecondParameter<T extends (...args: never) => unknown> = NonNullable<Parameters<T>[1]>;";

let updatedClient = generatedClient;
if (updatedClient.includes(unfilteredType)) {
  updatedClient = updatedClient.replace(unfilteredType, filteredType);
} else if (!updatedClient.includes(filteredType)) {
  throw new Error("Unexpected Orval SecondParameter type in generated client.");
}

const historyRangeValues = "'1m' | '6m' | '1y' | '5y'";
const historyRangeType = "StockPriceHistoryRange";
const historyRangeAlias = `type ${historyRangeType} = ${historyRangeValues};`;
const historyRangeOccurrences =
  updatedClient.split(historyRangeValues).length - 1;

if (historyRangeOccurrences > 0) {
  updatedClient = updatedClient.replaceAll(
    historyRangeValues,
    historyRangeType,
  );
  const awaitedInputType = "type AwaitedInput<T> = PromiseLike<T> | T;";

  if (updatedClient.includes(awaitedInputType)) {
    updatedClient = updatedClient.replace(
      awaitedInputType,
      `${historyRangeAlias}\n\n${awaitedInputType}`,
    );
  } else {
    throw new Error(
      "Unable to locate the generated API type alias insertion point.",
    );
  }
} else if (!updatedClient.includes(historyRangeAlias)) {
  throw new Error("Unexpected generated stock price history range type.");
}

const mutationSetupPattern =
  /const \{mutation: mutationOptions, request: requestOptions\} = options \?\s+options\.mutation && 'mutationKey' in options\.mutation && options\.mutation\.mutationKey \?\s+options\s+: \{\.\.\.options, mutation: \{\.\.\.options\.mutation, mutationKey\}\}\s+: \{mutation: \{ mutationKey, \}, request: undefined\};/g;
const mutationSetupMatches = [...updatedClient.matchAll(mutationSetupPattern)];

if (mutationSetupMatches.length !== 2) {
  throw new Error(
    `Expected 2 generated mutation option ternaries, found ${mutationSetupMatches.length}.`,
  );
}

updatedClient = updatedClient.replace(
  mutationSetupPattern,
  `const resolvedOptions = options ?? { mutation: { mutationKey } };
const hasMutationKey =
  resolvedOptions.mutation &&
  'mutationKey' in resolvedOptions.mutation &&
  resolvedOptions.mutation.mutationKey;
const mutationOptionsAndRequest = hasMutationKey
  ? resolvedOptions
  : {
      ...resolvedOptions,
      mutation: { ...resolvedOptions.mutation, mutationKey },
    };
const { mutation: mutationOptions, request: requestOptions } =
  mutationOptionsAndRequest;`,
);

await writeFile(generatedClientPath, updatedClient);
