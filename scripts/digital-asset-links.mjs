import assert from "node:assert/strict";

export const handleAllUrlsRelation =
    "delegate_permission/common.handle_all_urls";

export const assertHandleAllUrlsRelation = (relation, label) => {
    assert.ok(Array.isArray(relation), `${label} relation must be an array`);
    assert.ok(
        relation.includes(handleAllUrlsRelation),
        `${label} must delegate URL handling`,
    );
};
