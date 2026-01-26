# IAI Injection System & Mission Control

## Overview
A comprehensive code injection and mission management system for IAI (Intelligent Autonomous Intelligence) within the DealersFace platform.

---

## Architecture

### 1. Injection System
```
┌─────────────────────────────────────────────────────────────────┐
│                        CODE INJECTOR                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Container A │  │ Container B │  │ Container C │  ...          │
│  │ (FBM Flow)  │  │ (Messaging) │  │ (Analytics) │              │
│  │             │  │             │  │             │              │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │              │
│  │ │Pattern 1│ │  │ │Pattern 1│ │  │ │Pattern 1│ │              │
│  │ │(Default)│ │  │ │(Default)│ │  │ │(Default)│ │              │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │              │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │             │              │
│  │ │Pattern 2│ │  │ │Pattern 2│ │  │             │              │
│  │ └─────────┘ │  │ └─────────┘ │  │             │              │
│  │ ┌─────────┐ │  │             │  │             │              │
│  │ │Pattern 3│ │  │             │  │             │              │
│  │ └─────────┘ │  │             │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IAI INSTANCE CREATION                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Random Pattern Selection from Container Pool             │    │
│  │ - First pattern = default if available                   │    │
│  │ - Random selection for variety                           │    │
│  │ - Weighted selection based on success rate               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Mission Control
```
┌─────────────────────────────────────────────────────────────────┐
│                      MISSION CONTROL                             │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   MISSIONS   │    │    TASKS     │    │  SCHEDULES   │       │
│  │              │    │              │    │              │       │
│  │ ○ Daily Post │    │ ● FBM Post   │    │ ⏰ Cron      │       │
│  │ ○ Lead Gen   │    │ ● Message    │    │ ⏰ Manual    │       │
│  │ ○ Analytics  │    │ ● Analyze    │    │ ⏰ Triggered │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              MISSION PLANNER                             │    │
│  │  - Assign Patterns to Tasks                              │    │
│  │  - Assign Containers to Missions                         │    │
│  │  - Configure Execution Parameters                        │    │
│  │  - Set Success Criteria                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### InjectionContainer
```typescript
{
  id: string;
  name: string;
  description: string;
  category: 'fbm_flow' | 'messaging' | 'analytics' | 'automation' | 'custom';
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  patterns: InjectionPattern[];
  createdAt: Date;
  updatedAt: Date;
}
```

### InjectionPattern
```typescript
{
  id: string;
  containerId: string;
  name: string;
  description: string;
  code: string;  // The actual injectable code/logic
  version: string;
  isDefault: boolean;
  isActive: boolean;
  priority: number;
  config: {
    timeout: number;
    retryCount: number;
    failureAction: 'skip' | 'retry' | 'abort';
  };
  stats: {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    avgExecutionTime: number;
    lastExecuted: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Mission
```typescript
{
  id: string;
  name: string;
  description: string;
  type: 'scheduled' | 'manual' | 'triggered';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  containerId: string;
  schedule?: {
    cron: string;
    timezone: string;
    startDate: Date;
    endDate?: Date;
  };
  tasks: MissionTask[];
  config: {
    maxConcurrency: number;
    retryPolicy: 'none' | 'linear' | 'exponential';
    alertOnFailure: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### MissionTask
```typescript
{
  id: string;
  missionId: string;
  patternId: string;
  name: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: Record<string, any>;
  output?: Record<string, any>;
  executedAt?: Date;
  completedAt?: Date;
  error?: string;
}
```

---

## Implementation Progress

### Phase 1: Database & Backend ⏳
- [ ] Add Prisma schema for injection system
- [ ] Create injection service
- [ ] Create injection routes
- [ ] Create mission control service
- [ ] Create mission control routes

### Phase 2: Frontend Components ⏳
- [ ] Injection tab component
- [ ] Container management UI
- [ ] Pattern modal with statistics
- [ ] Mission Control tab
- [ ] Mission Planner UI

### Phase 3: Integration ⏳
- [ ] Wire injection to IAI creation
- [ ] Implement random pattern selection
- [ ] Add mission execution engine
- [ ] Build and deploy

---

## API Endpoints

### Injection API
```
POST   /api/iai/injection/containers          - Create container
GET    /api/iai/injection/containers          - List containers
GET    /api/iai/injection/containers/:id      - Get container
PUT    /api/iai/injection/containers/:id      - Update container
DELETE /api/iai/injection/containers/:id      - Delete container

POST   /api/iai/injection/patterns            - Create pattern
GET    /api/iai/injection/patterns            - List patterns
GET    /api/iai/injection/patterns/:id        - Get pattern
PUT    /api/iai/injection/patterns/:id        - Update pattern
DELETE /api/iai/injection/patterns/:id        - Delete pattern

POST   /api/iai/injection/inject              - Execute injection
GET    /api/iai/injection/stats               - Get injection stats
```

### Mission Control API
```
POST   /api/iai/missions                      - Create mission
GET    /api/iai/missions                      - List missions
GET    /api/iai/missions/:id                  - Get mission
PUT    /api/iai/missions/:id                  - Update mission
DELETE /api/iai/missions/:id                  - Delete mission

POST   /api/iai/missions/:id/execute          - Execute mission
POST   /api/iai/missions/:id/pause            - Pause mission
POST   /api/iai/missions/:id/resume           - Resume mission
GET    /api/iai/missions/:id/logs             - Get mission logs

POST   /api/iai/missions/:id/tasks            - Add task to mission
PUT    /api/iai/missions/:id/tasks/:taskId    - Update task
DELETE /api/iai/missions/:id/tasks/:taskId    - Remove task
```

---

## Security Considerations

1. **Code Injection Safety**
   - All patterns run in sandboxed environment
   - No direct database access from patterns
   - Rate limiting on injection execution
   - Audit logging for all injections

2. **Access Control**
   - Root admin only for pattern creation
   - Mission execution requires admin role
   - Container management requires elevated privileges

3. **Validation**
   - Pattern code syntax validation
   - Input sanitization
   - Output validation

---

## Status: IN PROGRESS
Last Updated: 2026-01-26
