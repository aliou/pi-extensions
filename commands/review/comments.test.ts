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

const NEW_FILE_DIFF = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;`;

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

  it("ignores git metadata for new files", () => {
    expect(extractComments(NEW_FILE_DIFF)).toEqual([]);
  });

  it("extracts comments in new file hunks", () => {
    const annotated = NEW_FILE_DIFF.replace(
      "+const b = 2;",
      "Needs a better name\n+const b = 2;",
    );

    expect(extractComments(annotated)).toEqual([
      {
        file: "src/new.ts",
        line: 2,
        comment: "Needs a better name",
      },
    ]);
  });
});
