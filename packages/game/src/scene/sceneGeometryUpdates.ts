/** Compilation stays pending until its geometry has committed to this Canvas. */
export class SceneGeometryUpdates {
    private pending = 0;
    private committedRevision = 0;

    get pendingCount() {
        return this.pending;
    }

    get revision() {
        return this.committedRevision;
    }

    begin() {
        this.pending++;
        let active = true;
        return (committed = false) => {
            if (!active) return false;
            active = false;
            this.pending--;
            if (committed) this.committedRevision++;
            return true;
        };
    }
}
