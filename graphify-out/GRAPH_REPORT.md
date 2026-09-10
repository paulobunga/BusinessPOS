# Graph Report - BusinessPOS  (2026-09-10)

## Corpus Check
- Corpus is ~3,714 words - fits in a single context window. You may not need a graph.

## Summary
- 75 nodes · 114 edges · 10 communities (7 shown, 3 thin omitted)
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Data Model & Storage
- Electron Architecture & IPC
- Auth, Till & Routing
- UI Foundation & Design System
- Core UI Components
- Data Reliability & Backup
- Project Overview
- Iconography
- Expenses Module
- Settings Module

## God Nodes (most connected - your core abstractions)
1. `SQLite Data Model (Schema)` - 16 edges
2. `IPC Contract (API Surface)` - 13 edges
3. `Folder Structure` - 8 edges
4. `Core Components` - 6 edges
5. `better-sqlite3 (SQLite Driver)` - 6 edges
6. `Phase 0 - Project Setup` - 6 edges
7. `Phase 5 - Sell Screen (Core Flow)` - 6 edges
8. `Tech Stack` - 5 edges
9. `users Table` - 5 edges
10. `items Table` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Sales Functional Requirements (FR-1 to FR-8)` --references--> `SQLite Data Model (Schema)`  [INFERRED]
  requirements.md → design.md
- `Till / Cash Drawer Requirements (FR-16 to FR-18)` --references--> `IPC Contract (API Surface)`  [INFERRED]
  requirements.md → design.md
- `Phase 5 - Sell Screen (Core Flow)` --references--> `CartLine Component`  [INFERRED]
  tasks.md → design.md
- `NumPad Component` --rationale_for--> `Usability Non-Functional Requirements (NFR-4, NFR-5)`  [INFERRED]
  design.md → requirements.md
- `Offline-First Requirement (NFR-1)` --rationale_for--> `better-sqlite3 (SQLite Driver)`  [INFERRED]
  requirements.md → design.md

## Hyperedges (group relationships)
- **Design System (Color, Typography, Spacing, Components, Icons, Layout)** — design_design_principles, design_color_palette, design_typography, design_spacing_and_sizing, design_core_components, design_iconography, design_layout_pattern [EXTRACTED 1.00]
- **SQLite Database Schema (All Tables)** — design_data_model, design_table_users, design_table_categories, design_table_items, design_table_till_sessions, design_table_sales, design_table_sale_items, design_table_expenses, design_table_settings [EXTRACTED 1.00]
- **Electron IPC Architecture (Main Process, Preload, Renderer, Contract)** — design_electron_process_model, design_context_isolation, design_folder_structure_electron_main, design_folder_structure_preload, design_ipc_contract [EXTRACTED 1.00]

## Communities (10 total, 3 thin omitted)

### Community 0 - "Data Model & Storage"
Cohesion: 0.21
Nodes (14): Audit Trail Rationale (No Hard Deletes), SQLite Data Model (Schema), electron/db/repositories (Sales, Expenses, Items, Till), Integer Cents for Monetary Values, Snapshot Pricing Rationale, categories Table, items Table, sale_items Table (+6 more)

### Community 1 - "Electron Architecture & IPC"
Cohesion: 0.22
Nodes (13): Context Isolation (contextBridge + preload), Electron Process Model, Folder Structure, electron/main.ts (App Lifecycle), src/hooks (useSales, useExpenses, useTill, useSettings), electron/preload.ts (contextBridge), shared/types.ts (Shared TS Types), IPC Contract (API Surface) (+5 more)

### Community 2 - "Auth, Till & Routing"
Cohesion: 0.17
Nodes (13): src/pages (Sell, Expenses, Reports, Till, Menu, Settings, Login), PinPad Component, RequireRole Route Guard, Routing Map, expenses Table, till_sessions Table, users Table, Expenses Functional Requirements (FR-9 to FR-12) (+5 more)

### Community 3 - "UI Foundation & Design System"
Cohesion: 0.25
Nodes (11): Color Palette (Design Tokens), Design Principles, Electron Shell, React Router (HashRouter), React 18 UI Layer, Spacing and Sizing System, Tech Stack, Typography System (+3 more)

### Community 4 - "Core UI Components"
Cohesion: 0.27
Nodes (10): CartLine Component, Core Components, DataTable Component, src/context (CartContext, AuthContext, TillContext), ItemTile Component, Layout Pattern (Sidebar + Two-Pane), NumPad Component, State Management (React Context + useReducer + TanStack Query) (+2 more)

### Community 5 - "Data Reliability & Backup"
Cohesion: 0.43
Nodes (7): Backup Strategy, better-sqlite3 (SQLite Driver), WAL Mode (Crash Resilience), Data and System Requirements (FR-23 to FR-27), Offline-First Requirement (NFR-1), Phase 9 - Reliability and Backup, Stretch: Local-Network Multi-Terminal Sync

### Community 6 - "Project Overview"
Cohesion: 0.83
Nodes (4): Kitchen Point of Sale (Offline) Design, BusinessPOS, Kitchen Point of Sale (Offline) Requirements, Implementation Tasks Plan

## Knowledge Gaps
- **12 isolated node(s):** `Typography System`, `Iconography (Lucide)`, `React 18 UI Layer`, `settings Table`, `Reporting and History Requirements (FR-19 to FR-22)` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `IPC Contract (API Surface)` connect `Electron Architecture & IPC` to `Data Model & Storage`, `Auth, Till & Routing`, `Core UI Components`?**
  _High betweenness centrality (0.384) - this node is a cross-community bridge._
- **Why does `SQLite Data Model (Schema)` connect `Data Model & Storage` to `Electron Architecture & IPC`, `Auth, Till & Routing`, `Data Reliability & Backup`?**
  _High betweenness centrality (0.376) - this node is a cross-community bridge._
- **Why does `Phase 0 - Project Setup` connect `UI Foundation & Design System` to `Electron Architecture & IPC`, `Data Reliability & Backup`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `SQLite Data Model (Schema)` (e.g. with `IPC Contract (API Surface)` and `electron/db/repositories (Sales, Expenses, Items, Till)`) actually correct?**
  _`SQLite Data Model (Schema)` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `IPC Contract (API Surface)` (e.g. with `SQLite Data Model (Schema)` and `electron/main.ts (App Lifecycle)`) actually correct?**
  _`IPC Contract (API Surface)` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Typography System`, `Iconography (Lucide)`, `React 18 UI Layer` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._