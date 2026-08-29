package com.gredice.dostava.navigation;

/** Persistence boundary for the privacy-minimized pending handoff marker. */
public interface NavigationHandoffStore {
    NavigationHandoffStore NO_OP = new NavigationHandoffStore() {
        @Override
        public PendingNavigationHandoff read() {
            return null;
        }

        @Override
        public void write(PendingNavigationHandoff pending) { }

        @Override
        public void clear() { }
    };

    PendingNavigationHandoff read();

    void write(PendingNavigationHandoff pending);

    void clear();
}
