import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_HOME_SCREEN,
  getHomeScreen,
  setHomeScreen,
  type HomeScreenChoice,
} from "@/lib/homeScreenPref";

/** The chosen home screen, and a setter that swaps it immediately. */
export function useHomeScreen() {
  const queryClient = useQueryClient();
  const query = useQuery<HomeScreenChoice>({
    queryKey: ["home_screen"],
    queryFn: getHomeScreen,
    // Read once per launch; the setter below refreshes it.
    staleTime: Infinity,
  });

  const choose = useMutation({
    mutationFn: async (choice: HomeScreenChoice) => {
      await setHomeScreen(choice);
      return choice;
    },
    onSuccess: (choice) => queryClient.setQueryData(["home_screen"], choice),
  });

  return { choice: query.data ?? DEFAULT_HOME_SCREEN, isLoading: query.isLoading, choose };
}
