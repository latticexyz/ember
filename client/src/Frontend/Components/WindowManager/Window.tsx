import React from "react";

import { Text } from "../Common/Text";

export interface WindowProps {
  title: string;
  component: React.ReactChild;
  windowId: string;
}

export const Window: React.FC<WindowProps> = ({ children, component, windowId }) => {
  class ErrorBoundary extends React.Component<{}, { hasError: boolean }> {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
      // Update state so the next render will show the fallback UI.
      return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {}

    render() {
      if (this.state.hasError) {
        // You can render any custom fallback UI
        return <Text>Something went wrong while rendering this window.</Text>;
      }

      return this.props.children;
    }
  }

  return <ErrorBoundary>{component || null}</ErrorBoundary>;
};
