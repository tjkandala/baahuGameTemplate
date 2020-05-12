import { b, createRouter, SFC, bLazy } from "baahu";
import { Layout } from "./Layout";
import { Home } from "./Home";
import { Room } from "./Room";

const BuiltInLazy = bLazy(() => import("./LazyRoute"), <p>loading...</p>);

const Router = createRouter({
  "/": () => <Home />,
  "/:gameid": ({ gameid }) => <Room gameid={gameid} />,
  "/lazy": () => <BuiltInLazy id={9009} />,
  "/twice": () => <BuiltInLazy id={10009} />,
});

export const App: SFC = () => (
  <Layout>
    <Router />
  </Layout>
);
