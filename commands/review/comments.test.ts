import { describe, expect, it } from "vitest";
import { extractComments } from "./comments";

const ORIGINAL_DIFF = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 4;`;

describe("extractComments", () => {
  it("extracts inserted plain text comments", () => {
    const annotated = ORIGINAL_DIFF.replace(
      "+const b = 3;",
      "This needs a test\n+const b = 3;",
    );

    expect(extractComments(annotated)).toEqual([
      {
        file: "src/app.ts",
        line: 2,
        comment: "This needs a test",
      },
    ]);
  });

  it("ignores inserted diff lines", () => {
    const annotated = ORIGINAL_DIFF.replace(
      "+const b = 3;",
      "+const ignored = true;\n+const b = 3;",
    );

    expect(extractComments(annotated)).toEqual([]);
  });
});
