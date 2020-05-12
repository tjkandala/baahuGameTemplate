import { b, memoInstance, SFC } from "baahu";

export const Layout: SFC = (_props, children) => (
  <div>
    <Header pathname={location.pathname} />
    {children}
  </div>
);

const Header = memoInstance<{ pathname: string }>(({ pathname }) => (
  <div>
    <p>page: {pathname}</p>
  </div>
));
