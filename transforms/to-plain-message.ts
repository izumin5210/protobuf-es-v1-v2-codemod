import type { Transform } from "jscodeshift";

/**
 * Removes `.toPlainMessage()` calls, replacing with just the receiver object.
 * In protobuf-es v2, messages are already plain objects, so this method is unnecessary.
 */
const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const calls = root.find(j.CallExpression, {
    callee: {
      type: "MemberExpression",
      property: { type: "Identifier", name: "toPlainMessage" },
    },
    arguments: (args: unknown[]) => args.length === 0,
  });

  if (calls.length === 0) {
    return fileInfo.source;
  }

  calls.forEach((path) => {
    const callee = path.node.callee;
    if (callee.type === "MemberExpression") {
      j(path).replaceWith(callee.object);
    }
  });

  return root.toSource();
};

export default transform;
export const parser = "tsx";
