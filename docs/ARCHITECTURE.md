# ARCHITECTURE.md

# Student Analytics Dashboard -- Architecture

> This document records the technical architecture and major design
> decisions.

## High-Level Architecture

``` text
Student/Admin
      │
      ▼
Frontend (React + Vite)
      │
      ▼
Backend API (Flask)
      │
 ┌────┼────────────────────┐
 │    │                    │
 ▼    ▼                    ▼
Firebase          External Platforms      AI Service
(Auth + DB)       GitHub                  Summaries
                  LeetCode               Recommendations
                  HackerRank
                  Kaggle
```

## Core Components

### Frontend

-   Authentication
-   Student Dashboard
-   Admin Dashboard
-   Charts & Visualizations
-   Goal Tracking
-   Profile Management

### Backend

-   REST APIs
-   Business Logic
-   Platform Integrations
-   Snapshot Comparison
-   Analytics
-   AI Orchestration
-   Firebase Communication

### Firebase

-   Authentication
-   User Profiles
-   Student Records
-   Goals
-   Historical Snapshots
-   Cached AI Summaries
-   Analytics Cache

## User Roles

### Student

Can: - Sign in - Link platform usernames - View personal analytics -
Manage goals - Trigger manual sync - View AI recommendations

Cannot: - View other students - Access admin features

### Admin (Version 1)

Single administrator.

Can: - View all students - Compare selected students - View cohort
analytics - Trigger synchronisation - View AI insights

## Platform Integrations

### GitHub

Repositories, languages, commits, contribution activity.

### LeetCode

Solved problems, difficulty breakdown, contests (where available).

### HackerRank

Badges, certifications, problem-solving activity.

### Kaggle

Datasets, notebooks, competitions.

## Synchronisation Flow

1.  Fetch latest platform data.
2.  Normalize responses.
3.  Compare with latest snapshot.
4.  If unchanged → do nothing.
5.  If changed:
    -   Save snapshot.
    -   Recalculate analytics.
    -   Refresh AI cache.

Scheduled daily by default, with a manual "Sync Now" option.

## Historical Snapshots

Store only meaningful changes.

Used for: - Growth trends - Historical charts - AI context - Progress
tracking

## Analytics Dimensions

-   Problem Solving
-   Development Activity
-   Data Science
-   Consistency
-   Growth
-   Goal Completion

AI interprets these dimensions instead of using one arbitrary score.

## AI Strategy

Generate: - Student summaries - Student recommendations - Cohort
summaries - Cohort recommendations

Cache outputs and regenerate only when underlying analytics change.

## Goal Tracking

Students define measurable goals.

Examples: - Solve N problems - Earn HackerRank badges - Publish Kaggle
notebooks - Maintain GitHub activity

Goals influence analytics and AI recommendations.

## Error Handling

Gracefully handle: - Missing usernames - Missing profiles - API
failures - Rate limits - Temporary outages

Never let one platform failure break the application.

## UI Philosophy

Student: - Personal progress - Trends - Goals - AI guidance

Admin: - Cohort overview - Student comparison - Interactive charts -
Filters - AI insights

Modern, minimal, responsive.

## Security

-   Firebase Authentication
-   Secure configuration
-   Role-based access
-   Backend validation

## Version 2

-   Multiple admins
-   AI chat assistant
-   Notifications
-   More platform integrations
-   Report export

## Architecture Decisions Log

  Date         Decision               Reason
  ------------ ---------------------- --------------------------------------------------------
  TBD          Initial architecture   Starting point for the project
  2026-07-05   React Vite + Flask     Avoid unnecessary complexity of Next.js for this scope

## Maintenance Checklist

Before introducing any feature ask: 1. Does it fit the architecture? 2.
Can existing modules be reused? 3. Does it add unnecessary complexity?
4. Is a new file really needed? 5. Will another developer understand
this in six months?
