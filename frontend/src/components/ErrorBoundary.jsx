import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(error) {
    return { err: error };
  }

  componentDidCatch(error, info) {
    // Log discreto en consola
    console.error("UI error capturado:", error, info);
  }

  render() {
    const { err } = this.state;
    if (err) {
      // Fallback minimalista (no interfiere con estilos globales)
      return (
        <div style={{ padding: 16 }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Se produjo un problema</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {String(err?.message || err)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
