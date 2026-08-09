// Guards the pi-coding-agent transcript scrollbar marker patch.
//
// The marker provider itself needs a live session, so this exercises the pure
// classifier the patch adds: which transcript component gets which marker.
// Fails on unpatched code, where the methods do not exist.

import { InteractiveMode, UserMessageComponent } from "@earendil-works/pi-coding-agent";

let failed = 0;
const assert = (name, cond) => {
  console.log(`${cond ? "ok" : "not ok"} - ${name}`);
  if (!cond) failed++;
};

const proto = InteractiveMode.prototype;
for (const method of [
  "getTranscriptMarkers",
  "getLabeledTranscriptTargets",
  "getTranscriptMarkerKind",
  "measureComponentHeight",
]) {
  assert(`InteractiveMode.prototype.${method} exists`, typeof proto[method] === "function");
}
if (failed) {
  console.error(`\n${failed} patch assertion(s) failed`);
  process.exit(1);
}

const classify = (child, labeled) =>
  proto.getTranscriptMarkerKind.call(null, child, {
    messages: new Set(),
    entryIds: new Set(),
    texts: new Set(),
    ...labeled,
  });

const userComponent = new UserMessageComponent("what is the plan?");
const assistantLike = { lastMessage: { role: "assistant", content: [] } };
const customEntryLike = { entry: { id: "entry-7" } };

// Only labels are marked: an unlabeled transcript produces no markers at all.
assert("unlabeled user message gets no marker", classify(userComponent, {}) === undefined);
assert("assistant output gets no marker", classify(assistantLike, {}) === undefined);
assert("unlabeled custom entry gets no marker", classify(customEntryLike, {}) === undefined);

// `/label` labels the session leaf, which after a completed turn is the
// assistant entry — the case that matters most in practice.
assert(
  "labeled assistant message gets a label marker",
  classify(assistantLike, { messages: new Set([assistantLike.lastMessage]) }) === "label",
);
assert(
  "labeled custom entry gets a label marker",
  classify(customEntryLike, { entryIds: new Set(["entry-7"]) }) === "label",
);
assert(
  "labeled user message gets a label marker",
  classify(userComponent, { texts: new Set(["what is the plan?"]) }) === "label",
);
assert(
  "a label on another entry does not mark this user message",
  classify(userComponent, { texts: new Set(["a different message"]) }) === undefined,
);

if (failed) {
  console.error(`\n${failed} patch assertion(s) failed`);
  process.exit(1);
}
console.log("\nall patch assertions passed");
