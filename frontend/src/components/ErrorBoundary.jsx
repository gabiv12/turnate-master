// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(error) { return { err: error }; }
  componentDidCatch(error, info) {
    // además de renderizar, logueamos en consola
    console.error("[ErrorBoundary] error:", error, "info:", info);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{padding:"24px", fontFamily:"ui-sans-serif,system-ui", background:"#fff"}}>
          <h1 style={{fontSize:24, fontWeight:700, color:"#b91c1c"}}>Se produjo un error en la UI</h1>
          <p style={{marginTop:8}}>La página se puso en blanco por un error de React. Detalles abajo.</p>
          <pre style={{whiteSpace:"pre-wrap", marginTop:12, padding:12, background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8}}>
{String(this.state.err?.stack || this.state.err || "Error desconocido")}
          </pre>
          <p style={{marginTop:12, fontSize:12, color:"#475569"}}>
            Revisa la consola (F12 &rarr; Console) y los imports del componente que estabas abriendo.
          </p>
          <button onClick={()=>location.reload()} style={{marginTop:16, padding:"10px 16px", borderRadius:10, background:"#2563eb", color:"#fff", fontWeight:600}}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
