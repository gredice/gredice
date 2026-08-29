package com.gredice.dostava.navigation;

/** Fixed, generic notification contract for reopening the active car route. */
public final class QuickReturnNotificationSpec {
    public static final String CHANNEL_ID = "active-delivery-route";
    public static final String CHANNEL_NAME = "Aktivna dostava";
    public static final String TITLE = "Gredice Dostava";
    public static final String TEXT = "Otvori aktivnu rutu";
    public static final String CAR_ENTRY_URI = "gredice://delivery/active-route";
    public static final int NOTIFICATION_ID = 4_365;
    public static final int CAR_REQUEST_CODE = 43_650;
    public static final int PHONE_REQUEST_CODE = 43_651;

    private QuickReturnNotificationSpec() { }
}
