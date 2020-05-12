import { b, createMachine, linkTo } from "baahu";

export const Home = createMachine<{}>({
  id: "home",
  initialState: "loaded",
  initialContext: () => ({
    rooms: [],
  }),
  states: {
    loading: {},
    loaded: {},
  },
  render: () => (
    <div>
      <button onClick={() => linkTo("/foo")}>go to foo</button>
      <button onClick={() => linkTo("/lazy")}>go to lazy</button>
      <button onClick={() => linkTo("/twice")}>go to twice</button>
    </div>
  ),
});
