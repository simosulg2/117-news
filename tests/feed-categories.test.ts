import assert from "node:assert/strict";
import test from "node:test";

import { feedCategoryText } from "../lib/feed-categories.ts";

test("reads category labels from both RSS string and XML object formats", () => {
  assert.equal(feedCategoryText(["Sport", "Kergejõustik"]), "Sport Kergejõustik");

  const sport = Object.assign(Object.create(null) as Record<string, unknown>, {
    _: "Sport",
    $: Object.assign(Object.create(null) as Record<string, unknown>, {
      domain: "https://sport.postimees.ee",
    }),
  });
  const athletics = Object.assign(Object.create(null) as Record<string, unknown>, {
    _: "Kergejõustik",
    $: Object.assign(Object.create(null) as Record<string, unknown>, {
      domain: "https://sport.postimees.ee/section/161",
    }),
  });
  assert.equal(
    feedCategoryText([sport, athletics]),
    "Sport Kergejõustik",
  );
});

test("ignores malformed category entries without coercing them", () => {
  const hostile = Object.create(null) as { toString?: () => string };
  hostile.toString = () => {
    throw new Error("must not be called");
  };

  assert.equal(feedCategoryText([null, 42, {}, hostile, { _: 123 }, { _: "Eesti" }]), "Eesti");
});
