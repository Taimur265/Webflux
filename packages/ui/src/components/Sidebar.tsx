import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Sidebar.css';

interface Flow {
  flow_id: string;
  name: string;
  description: string;
}

interface SidebarProps {
  onSelectFlow: (flowId: string) => void;
}

export default function Sidebar({ onSelectFlow }: SidebarProps) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const response = await axios.get('/api/flows');
      setFlows(response.data.flows || []);
    } catch (error) {
      console.error('Failed to load flows:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Flows</h2>
        <button className="btn-new">+ New</button>
      </div>

      <div className="sidebar-content">
        {loading ? (
          <p className="loading">Loading...</p>
        ) : flows.length === 0 ? (
          <p className="empty">No flows yet</p>
        ) : (
          <ul className="flow-list">
            {flows.map((flow) => (
              <li
                key={flow.flow_id}
                className="flow-item"
                onClick={() => onSelectFlow(flow.flow_id)}
              >
                <div className="flow-name">{flow.name}</div>
                <div className="flow-description">{flow.description}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
