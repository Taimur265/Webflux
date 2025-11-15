import React, { useState } from 'react';
import FlowEditor from './components/FlowEditor';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <h1>UWG Engine</h1>
        <p>Unified Website Graph - Flow Editor</p>
      </header>

      <div className="app-content">
        <Sidebar onSelectFlow={setSelectedFlow} />
        <FlowEditor flowId={selectedFlow} />
      </div>
    </div>
  );
}

export default App;
