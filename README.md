# AVS-PEG

Autonomous Vehicle Simulation - Pathfinding Environment Generator

A 3D simulation environment for autonomous vehicles, built with Next.js, React, and Three.js. This tool allows users to design road networks, place traffic lights, simulate vehicle behavior, and test autonomous driving algorithms in a controlled virtual world.

## Features

### Road Network Design

- **Graph-Based Editing**: Create and modify road networks using nodes and edges
- **Interactive Editor**: Click and drag to add/remove road segments
- **Visual Road Generation**: Automatically generates 3D road geometry from graph structures
- **Road Envelopes**: Configurable road width and roundness for realistic rendering

### Traffic Light System

- **Traffic Light Placement**: Add and position traffic lights at junctions
- **Traffic Light Configuration**: Customize timing, phases, and behavior
- **Traffic Light Graph**: Manage logical connectivity between traffic lights
- **Real-time Simulation**: Dynamic traffic light state changes during simulation

### Vehicle Simulation

- **Physics-Based Movement**: Realistic car physics with acceleration, friction, and speed limits
- **Sensor Suite**: Ray-casting sensors for obstacle detection and autonomous navigation
- **Collision Detection**: Polygon-based collision detection between vehicles and environment
- **3D Visual Models**: GLTF model loading for realistic vehicle rendering

### World Management

- **OpenStreetMap Integration**: Import real-world road data from OSM
- **Save/Load Functionality**: Persist world configurations as JSON files
- **Mini Map Overlay**: Top-down view for navigation and overview
- **Multiple Editing Modes**: Switch between graph editing and traffic light configuration

### User Interface

- **Mode Controls**: Easy switching between different editing modes
- **File Toolbar**: Quick access to import, save, and load operations
- **Modal Interfaces**: Clean UI for OSM import and other operations
- **Responsive Design**: Built with Tailwind CSS for modern, responsive UI

## Technologies Used

- **Frontend Framework**: Next.js 16 with React 19
- **3D Rendering**: Three.js for WebGL-based 3D graphics
- **Styling**: Tailwind CSS for utility-first CSS
- **TypeScript**: Full type safety and modern JavaScript features
- **Package Manager**: Bun for fast dependency management

## Installation

1. Ensure you have Bun installed (version 1.3 or higher)
2. Clone the repository
3. Install dependencies:
   ```bash
   bun install
   ```

## Usage

1. Start the development server:

   ```bash
   bun run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Click "World" to enter the simulation environment

4. Use the mode controls to switch between:
   - **Graph Mode**: Edit road networks by adding/removing nodes and edges
   - **Traffic Lights Mode**: Place and configure traffic lights

5. Use the file toolbar to:
   - Import OSM data for real-world road networks
   - Save your world configuration
   - Load previously saved worlds

6. The mini map overlay provides a top-down view for navigation

## Project Structure

- `app/`: Next.js app router pages
- `components/`: React components including world simulation and UI
- `lib/`: Core simulation logic (world, car, editors, primitives)
- `hooks/`: Custom React hooks for world management
- `types/`: TypeScript type definitions
- `utils/`: Utility functions for math, rendering, and OSM integration
- `services/`: External service integrations (OpenStreetMap)

## Contributing

This project is part of a final year project for autonomous vehicle simulation research.
