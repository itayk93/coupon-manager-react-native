import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Which home screen the person wants.
 *
 * `HomeAltScreen` was built, reviewed and then left behind an admin gate, so
 * the best work on the character was the only thing nobody could see. Forcing
 * it on everyone is the wrong way to release it — this makes it a choice, and
 * a reversible one.
 *
 * Device-local: it is a display preference, not something the server needs to
 * know, and it should not follow an account onto someone else's phone.
 */
const KEY = "home_screen:v1";

export type HomeScreenChoice = "classic" | "kuponi";

export const DEFAULT_HOME_SCREEN: HomeScreenChoice = "classic";

export async function getHomeScreen(): Promise<HomeScreenChoice> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "kuponi" ? "kuponi" : DEFAULT_HOME_SCREEN;
  } catch {
    return DEFAULT_HOME_SCREEN;
  }
}

export async function setHomeScreen(choice: HomeScreenChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, choice);
  } catch {
    // Best-effort. Losing the preference means the familiar screen, which is
    // the safe way to fail.
  }
}
