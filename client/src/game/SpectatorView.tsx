import { b, createMachine } from "baahu";

export const SpectatorView = createMachine<{}>({
  id: "playerView",
  initialState: "syncing",
  initialContext: () => ({}),
  states: {
    syncing: {
      onEntry: syncState,
    },
    playing: {},
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
