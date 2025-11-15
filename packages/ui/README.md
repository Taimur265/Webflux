# UWG UI - Visual Flow Editor

React-based visual flow editor for the UWG Engine.

## Features

- **Visual Flow Editor**: Drag-and-drop interface for building flows
- **Node Palette**: Browse and add nodes from all categories
- **Real-time Validation**: Instant feedback on flow validity
- **Execution Control**: Run flows directly from the UI
- **Flow Management**: Create, edit, save, and delete flows

## Development

```bash
npm install
npm run dev
```

The UI will be available at `http://localhost:3001`.

## Build

```bash
npm run build
```

## Stack

- **React** - UI framework
- **ReactFlow** - Flow editor library
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Axios** - HTTP client

## API Integration

The UI communicates with the UWG API server (running on port 3000) via proxied requests.

## Components

- **App** - Main application shell
- **Sidebar** - Flow list and management
- **FlowEditor** - Visual flow editing canvas
- **NodePalette** - Draggable node library
- **PropertyPanel** - Node configuration
