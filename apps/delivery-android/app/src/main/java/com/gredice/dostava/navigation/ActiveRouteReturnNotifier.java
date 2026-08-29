package com.gredice.dostava.navigation;

/** Android notification boundary kept replaceable for deterministic policy tests. */
public interface ActiveRouteReturnNotifier {
    ActiveRouteReturnNotifier NO_OP = new ActiveRouteReturnNotifier() {
        @Override
        public void initializeChannel() { }

        @Override
        public PostResult postOrUpdate() {
            return PostResult.SKIPPED;
        }

        @Override
        public boolean cancel() {
            return false;
        }
    };

    void initializeChannel();

    PostResult postOrUpdate();

    boolean cancel();

    enum PostResult {
        POSTED,
        DISABLED,
        SKIPPED
    }
}
