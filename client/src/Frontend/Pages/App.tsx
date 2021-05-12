import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import { Play } from "./Play";

export const App: React.FC = () => {
  return (
    <Router>
      <Switch>
        <Route path="/">
          <Play />
        </Route>
      </Switch>
    </Router>
  );
};
