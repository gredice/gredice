// Event Sourcing
// References:
//   - https://github.com/eugene-khyst/postgresql-event-sourcing
// 
// Events --Stream--> Snapshot
// TODO: Snapshotting
//   - On every nth event make aggregate snapshot
// TODO: Generating Projection:
//   - Load last snapshot
//   - Load events after snapshot and replay them
