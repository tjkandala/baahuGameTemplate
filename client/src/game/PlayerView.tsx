import { b, createMachine } from "baahu";

interface PlayerViewProps {
  initialState: any;
}

type PlayerViewState = "syncing" | "playing" | "waiting" | "complete";

export const PlayerView = createMachine<PlayerViewProps, PlayerViewState>({
  id: "playerView",
  initialState: "syncing",
  initialContext: () => ({}),
  states: {
    syncing: {
      onEntry: syncState,
      on: {
        // has synced context + the player hasn't played this turn yet
        SYNCED_PLAYING: {},
        // has synced context + the player has played this turn
        SYNCED_WAITING: {},
      },
    },
    playing: {
      on: {
        PLAY_CARD: {
          effects: () => "emit to server",
          target: "waiting",
        },
      },
    },
    waiting: {},
    complete: {},
  },
  render: (state) => (
    <div>
      <h3>player view</h3>
      <p>{state}</p>
    </div>
  ),
});

function syncState() {}
