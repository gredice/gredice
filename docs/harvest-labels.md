# Farm harvest labels

The Farm schedule groups conventional field harvest labels within the same account, garden, physical raised bed, operation type, plant sort, and scheduled day in Europe/Zagreb. Only consecutive physical positions share a label. Runs split at gaps and after nine fields: twenty matching fields become `1-9`, `10-18`, and `19-20`.

Whole-bed harvests include only harvest-ready fields. Explicit field harvests remain printable for their historical crop at the operation date. Selected planting traces retain their existing planting scope. Sowing and other operation labels keep their existing grouping rules.

Each grouped QR opens `/trag/grupa/[token]`, where the recipient selects a field to open its original crop history. Membership is stored as an immutable `harvestTraceGroup.create` version 1 event. The public group token is derived from the members' random public tokens, without exposing internal IDs. Repeated generation of the same membership reuses its QR. New crops and subsequent harvests do not change a printed group's membership. Revoked traces and deleted gardens, beds, fields, or operations are omitted; a group with no available members is unavailable.

The print dialog starts with one copy per label. Farmers can select labels and choose 1-99 copies of each. Only selected labels are sent to the printer, and successful grouped printing marks every member trace as printed once regardless of copy count.
