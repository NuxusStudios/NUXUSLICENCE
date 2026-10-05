// Push notifications are native-only. The web build (previews, demo page)
// gets a no-op so expo-notifications isn't bundled or initialised there.
export function usePushRegistration(_enabled: boolean) {}
