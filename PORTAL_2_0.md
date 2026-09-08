# Client Portal 2.0

## Product principle

The workspace answers two questions immediately:

- Customer: What is the next thing I need to do?
- Admin: Which customer/project needs attention now?

## Core model

- `project_actions`: upload, approval and confirmation actions with state and optional due date.
- `project_events`: append-only activity stream generated from uploads, messages, action changes and project phase changes.
- `portal_notifications`: in-app notification inbox distributed from project events.
- `project_files.action_id`: connects deliverables to the action they satisfy.

## Main surfaces

- `/portal`: next-action workspace, approvals, timeline, notifications, files and messages.
- `/admin/ops`: attention queue and action composer.
- `/admin/search`: global search across clients, projects and filenames.
- `/admin/clients/[id]`: customer dossier.

## Quality rules

- RLS remains the authorization boundary.
- Customer mutations that require restricted state transitions use SECURITY DEFINER RPCs with explicit ownership checks.
- Admin/customer identity remains separate; no impersonation.
- File storage remains private with signed download URLs.
- E-mail remains a secondary channel; the portal notification/event model is the system of record for workspace activity.
