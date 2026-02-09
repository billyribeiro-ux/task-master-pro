# TaskMaster Pro -- Security & Edge-Case E2E Test Report

**Generated:** 2026-02-09T10:23:13.145Z
**Server:** http://localhost:4173
**Total Tests:** 69
**Passed:** 69
**Failed:** 0
**Skipped:** 0
**Pass Rate:** 100.0%

---

## Summary by Category

| Category | Passed | Failed | Skipped | Total |
|----------|--------|--------|---------|-------|
| Setup | 4 | 0 | 0 | 4 |
| AuthBypass | 6 | 0 | 0 | 6 |
| CrossProject | 6 | 0 | 0 | 6 |
| Boundary | 12 | 0 | 0 | 12 |
| XSS | 10 | 0 | 0 | 10 |
| MIME | 7 | 0 | 0 | 7 |
| Concurrent | 2 | 0 | 0 | 2 |
| CascadeDelete | 10 | 0 | 0 | 10 |
| RBAC | 12 | 0 | 0 | 12 |

---

## Detailed Results

### Setup

- [PASS] **Register User A** (98ms)
  - Session acquired
- [PASS] **Register User B** (50ms)
  - Session acquired
- [PASS] **Create Project A (User A)** (22ms)
  - projectId=to0lwvp9vk10a1es2amkre0i
- [PASS] **Create Project B (User B)** (26ms)
  - projectId=vaz7fdd6do0b1fms02d1ztq7

### AuthBypass

- [PASS] **Access other user project tasks (should 403)** [HTTP 403] (3ms)
  - Correctly denied
- [PASS] **Update task in foreign project (should 403)** [HTTP 403] (5ms)
  - Correctly denied
- [PASS] **Delete task as viewer (should 403)** [HTTP 403] (3ms)
  - Viewer correctly denied delete
- [PASS] **Access /api/v1/users/me with invalid session** [HTTP 401] (4ms)
  - 401 as expected
- [PASS] **Access /api/v1/users/me with empty session** [HTTP 401] (2ms)
  - 401 as expected
- [PASS] **Create task in nonexistent project** [HTTP 403] (3ms)
  - Rejected with 403

### CrossProject

- [PASS] **Create isolated Project B** (20ms)
  - projectId=rzvnvmmxx59a05a58s5kvfv8
- [PASS] **User A lists tasks from isolated Project B (should 403)** [HTTP 403] (2ms)
  - Access denied
- [PASS] **User B creates task in Project A (should 403)** [HTTP 403] (2ms)
  - Access denied
- [PASS] **User B updates Project A settings (should fail)** [HTTP 403] (3ms)
  - Settings update denied
- [PASS] **User B invites to Project A (should fail)** [HTTP 403] (2ms)
  - Invitation denied
- [PASS] **User A creates label in isolated Project B (should 403)** [HTTP 403] (2ms)
  - Access denied

### Boundary

- [PASS] **Create task with 500-char title (max allowed)** [HTTP 201] (14ms)
  - Title stored: 500 chars
- [PASS] **Create task with 501-char title (should fail)** [HTTP 400] (3ms)
  - Correctly rejected
- [PASS] **Create task with empty title (should fail)** [HTTP 400] (3ms)
  - Correctly rejected
- [PASS] **Create comment with 10000-char body (max)** [HTTP 201] (11ms)
  - Body stored: 10000 chars
- [PASS] **Create comment with 10001-char body (should fail)** [HTTP 400] (2ms)
  - Correctly rejected
- [PASS] **Create comment with empty body (should fail)** [HTTP 400] (2ms)
  - Correctly rejected
- [PASS] **Create label with empty name (should fail)** [HTTP 400] (3ms)
  - Correctly rejected
- [PASS] **Create label with 51-char name (should fail)** [HTTP 400] (2ms)
  - Correctly rejected
- [PASS] **Create task with invalid priority (should fail)** [HTTP 400] (3ms)
  - Correctly rejected
- [PASS] **Update task with invalid status (should fail)** [HTTP 400] (3ms)
  - Correctly rejected
- [PASS] **Create task with negative storyPoints (should fail)** [HTTP 400] (2ms)
  - Correctly rejected
- [PASS] **Create task with negative estimateMinutes (should fail)** [HTTP 400] (2ms)
  - Correctly rejected

### XSS

- [PASS] **Create task with <script> in title** [HTTP 201] (14ms)
  - Stored as-is: "<script>alert(1)</script>" (not executed, safely stored)
- [PASS] **Retrieve XSS task via API (stored as-is)** [HTTP 200] (3ms)
  - Title returned as plain text: "<script>alert(1)</script>"
- [PASS] **XSS payload in title: <img src=x onerror=alert(1)>...** [HTTP 201] (15ms)
  - Stored safely, title="<img src=x onerror=alert(1)>"
- [PASS] **XSS payload in title: "><svg/onload=alert(1)>...** [HTTP 201] (13ms)
  - Stored safely, title=""><svg/onload=alert(1)>"
- [PASS] **XSS payload in title: javascript:alert(1)...** [HTTP 201] (12ms)
  - Stored safely, title="javascript:alert(1)"
- [PASS] **XSS payload in title: <iframe src="javascript:alert(...** [HTTP 201] (12ms)
  - Stored safely, title="<iframe src="javascript:alert(1)"></iframe>"
- [PASS] **Create comment with XSS payload in body** [HTTP 201] (8ms)
  - Stored as-is (safe for API return, frontend must escape)
- [PASS] **Create project with SQL injection name** [HTTP 200] (19ms)
  - Project created safely (parameterized queries), id=cb92974moj57uldh3i4o616f
- [PASS] **Verify users table intact after SQL injection** (0ms)
  - users table has 22 rows
- [PASS] **SQL injection name stored literally** (0ms)
  - name="'; DROP TABLE users; --"

### MIME

- [PASS] **Upload with application/x-executable (should 400)** [HTTP 400] (2ms)
  - Correctly rejected
- [PASS] **Upload with text/html (should 400)** [HTTP 400] (2ms)
  - Correctly rejected
- [PASS] **Upload with application/x-sh (should 400)** [HTTP 400] (2ms)
  - Correctly rejected
- [PASS] **Upload with image/png (should work)** [HTTP 201] (8ms)
  - Presigned URL generated, attachment id=iep4ohuai1yskv6densxk758
- [PASS] **Upload with application/pdf (should work or 500)** [HTTP 201] (8ms)
  - Status 201 (MIME check passed)
- [PASS] **Upload with 100MB file (exactly at limit)** [HTTP 201] (8ms)
  - Status 201
- [PASS] **Upload with 100MB+1 file (over limit)** [HTTP 400] (2ms)
  - Correctly rejected

### Concurrent

- [PASS] **Create 5 tasks concurrently (unique displayIds)** (64ms)
  - All unique: TM-10, TM-11, TM-12, TM-13, TM-14
- [PASS] **Start 2 timers concurrently on same task (one succeeds)** (13ms)
  - 1 succeeded (201), 1 conflicted (409)

### CascadeDelete

- [PASS] **Setup: project with task, comment, time entry, label** (0ms)
  - project=gyqcmge35av091nd8xoohtdb, task=nieguoyah453epnxmhgpbf1c
- [PASS] **Delete project via DB** (10ms)
  - Deleted project gyqcmge35av091nd8xoohtdb
- [PASS] **Tasks deleted on project delete** (0ms)
  - No orphaned tasks
- [PASS] **Comments deleted on task cascade** (0ms)
  - No orphaned comments
- [PASS] **Time entries deleted on task cascade** (0ms)
  - No orphaned time entries
- [PASS] **Columns deleted on project delete** (0ms)
  - No orphaned columns
- [PASS] **Labels deleted on project delete** (0ms)
  - No orphaned labels
- [PASS] **Project members deleted on project delete** (0ms)
  - No orphaned members
- [PASS] **Activity log deleted on project delete** (0ms)
  - No orphaned activity logs
- [PASS] **Project counters deleted on project delete** (0ms)
  - No orphaned counters

### RBAC

- [PASS] **Setup: owner, member, viewer for role project** (0ms)
  - project=yuro6jzr0zmh1ed2xcws5qqs
- [PASS] **Create 3 tasks as owner** (0ms)
  - task1=kv36mm67jtowqj6arhc56p2i, task2=toc31icavxzssmgazq2i5ukm, task3=uyzf3umm0ifckzy8ly4j6d4v
- [PASS] **Owner can delete tasks** [HTTP 200] (9ms)
  - Task deleted successfully
- [PASS] **Member can delete tasks** [HTTP 200] (9ms)
  - Task deleted successfully
- [PASS] **Viewer CANNOT delete tasks (should 403)** [HTTP 403] (3ms)
  - Correctly denied
- [PASS] **Viewer CAN read tasks** [HTTP 200] (3ms)
  - 1 tasks visible
- [PASS] **Viewer CAN read single task** [HTTP 200] (3ms)
  - task=uyzf3umm0ifckzy8ly4j6d4v
- [PASS] **Viewer CAN create comments** [HTTP 201] (10ms)
  - comment=st6um8zyg00k72imrmmo4pym
- [PASS] **Viewer CANNOT update project settings** [HTTP 403] (3ms)
  - Settings update denied for viewer
- [PASS] **Member CAN create tasks** [HTTP 201] (14ms)
  - task=pujg3nz4ko7cnw1ei7wia0yh
- [PASS] **Member CANNOT update project settings** [HTTP 403] (2ms)
  - Settings update denied for member
- [PASS] **Member CANNOT invite users** [HTTP 403] (2ms)
  - Invitation denied for member role

---

## Test Categories Covered

| # | Category | Description |
|---|----------|-------------|
| 1 | Authorization Bypass | Access control bypass attempts |
| 2 | Cross-Project Access | Isolation between user projects |
| 3 | Boundary Values | Input validation edge cases |
| 4 | XSS / Injection | Script injection and SQL injection |
| 5 | MIME Allowlist | File type restriction enforcement |
| 6 | Concurrent Operations | Race conditions and atomicity |
| 7 | Cascade Delete | Foreign key cascade integrity |
| 8 | Role-Based Access | Owner/member/viewer permissions |
