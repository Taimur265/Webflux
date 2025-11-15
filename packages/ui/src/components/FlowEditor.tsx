import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import './FlowEditor.css';

interface FlowEditorProps {
  flowId: string | null;
}

export default function FlowEditor({ flowId }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowName, setFlowName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (flowId) {
      loadFlow(flowId);
    } else {
      setNodes([]);
      setEdges([]);
      setFlowName('');
    }
  }, [flowId]);

  const loadFlow = async (id: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/flows/${id}`);
      const flow = response.data.flow;

      setFlowName(flow.name);

      // Convert flow nodes to ReactFlow nodes
      const reactFlowNodes: Node[] = flow.graph.nodes.map((node: any) => ({
        id: node.id,
        type: getNodeType(node.category),
        data: {
          label: node.name,
          category: node.category,
          type: node.type,
        },
        position: {
          x: node.ui_hints.x,
          y: node.ui_hints.y,
        },
      }));

      // Convert connections to ReactFlow edges
      const reactFlowEdges: Edge[] = flow.graph.connections.map((conn: any, idx: number) => ({
        id: `edge-${idx}`,
        source: conn.from,
        target: conn.to,
        animated: true,
      }));

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
    } catch (error) {
      console.error('Failed to load flow:', error);
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const getNodeType = (category: string): string => {
    // Map node categories to visual types
    return 'default';
  };

  const runFlow = async () => {
    if (!flowId) return;

    try {
      await axios.post(`/api/flows/${flowId}/execute`);
      alert('Flow execution started! Check execution logs for results.');
    } catch (error) {
      console.error('Failed to execute flow:', error);
      alert('Failed to execute flow');
    }
  };

  if (!flowId) {
    return (
      <div className="flow-editor-empty">
        <h2>No flow selected</h2>
        <p>Select a flow from the sidebar or create a new one</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flow-editor-empty">
        <p>Loading flow...</p>
      </div>
    );
  }

  return (
    <div className="flow-editor">
      <div className="flow-editor-header">
        <h2>{flowName}</h2>
        <div className="flow-actions">
          <button className="btn-action" onClick={runFlow}>
            ▶ Run
          </button>
          <button className="btn-action">💾 Save</button>
        </div>
      </div>

      <div className="flow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
