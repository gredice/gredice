import assert from "node:assert/strict";
import test from "node:test";
import {
    assertHandleAllUrlsRelation,
    handleAllUrlsRelation,
} from "./digital-asset-links.mjs";

test("accepts an array containing the URL handling relation", () => {
    assert.doesNotThrow(() =>
        assertHandleAllUrlsRelation([handleAllUrlsRelation], "Test statement"),
    );
});

test("rejects a string relation even when it contains the expected value", () => {
    assert.throws(
        () => assertHandleAllUrlsRelation(handleAllUrlsRelation, "Test statement"),
        /relation must be an array/,
    );
});

test("rejects an array without the URL handling relation", () => {
    assert.throws(
        () => assertHandleAllUrlsRelation([], "Test statement"),
        /must delegate URL handling/,
    );
});
