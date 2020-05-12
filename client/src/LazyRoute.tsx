import { b, SFC, createMachine, emit, linkTo } from "baahu";

const LazyRoute: SFC<{ id: number }> = ({ id }) => (
  <div class="lazy-route">
    <p>lazy boy no. {id}</p>
    <LazyMachine />
    <button onClick={() => emit({ type: "TOGGLE" }, "lazy")}>toggle</button>
    <button
      onClick={() => {
        // debugger;
        linkTo("/");
      }}
    >
      go home
    </button>
  </div>
);

const LazyMachine = createMachine<{}>({
  id: "lazy",
  initialContext: () => ({}),
  initialState: "even",
  states: {
    even: {
      on: {
        TOGGLE: {
          target: "odd",
        },
      },
    },
    odd: {
      on: {
        TOGGLE: {
          target: "even",
        },
      },
    },
  },
  render: (state) => <p>{state}</p>,
});

export default LazyRoute;
