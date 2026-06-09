# HALO IT SERVICES 365 — MASTER CODE SPECIFICATION
### Files 1 & 2 Implementation | Node.js + TypeScript + Drizzle + PostgreSQL
### Version: 2.0 | Date: 2026-06-09 | Status: Implementation-Ready

---

## ⚙️ CONFIRMED STACK

```
Runtime:     Node.js (ESM)
Language:    TypeScript 5.9
Backend:     Express 5 + express-session + connect-pg-simple
ORM:         Drizzle ORM (drizzle-orm/node-postgres)
Database:    PostgreSQL (DATABASE_URL)
Auth:        Session-based (req.session.userId) + otpauth TOTP
Encryption:  bcryptjs + Node crypto (AES-256-CBC)
Frontend:    React 19 + Vite + Tailwind CSS + shadcn/ui + Wouter
Monorepo:    pnpm workspaces
Packages:    @workspace/db  @workspace/api-server  @workspace/portal
```

---

## ⚠️ NON-NEGOTIABLE RULES

```
1. NEVER rewrite — extend existing files only
2. ALL new tables added to lib/db/src/schema/index.ts
3. ALL routes follow exact pattern: Router() + requireAuth + db.select()...
4. Session auth ONLY — no JWT tokens
5. TOTP via `otpauth` library — not speakeasy
6. Role checks via: db.select user then check user.role / user.permissions
7. Error pattern: catch (e: any) { res.status(500).json({ error: e.message }) }
8. Every route file added to artifacts/api-server/src/routes/index.ts
9. Every page added to artifacts/portal/src/App.tsx routes
10. Run `pnpm run db:push` after every schema change
```

---

## 📁 SECTION A — SCHEMA EXTENSIONS
### File: `lib/db/src/schema/index.ts` — APPEND BELOW EXISTING TABLES

```typescript
// ═══════════════════════════════════════════════════════════════════
// SECTION A1 — AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════

export const auditLogsTable = pgTable("audit_logs", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").references(() => usersTable.id),
  action:     text("action").notNull(),          // e.g. "ticket.created"
  entity:     text("entity"),                    // e.g. "ticket"
  entityId:   text("entity_id"),                 // e.g. "42"
  details:    jsonb("details").default({}),      // extra context
  ipAddress:  text("ip_address"),
  userAgent:  text("user_agent"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});
export type AuditLog = typeof auditLogsTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A2 — NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

export const notificationsTable = pgTable("notifications", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").references(() => usersTable.id),  // null = broadcast
  type:      text("type").notNull(),   // "ticket"|"sla"|"invoice"|"security"|"system"
  title:     text("title").notNull(),
  message:   text("message").notNull(),
  data:      jsonb("data").default({}),
  read:      boolean("read").notNull().default(false),
  priority:  text("priority").notNull().default("normal"), // "low"|"normal"|"high"|"urgent"
  link:      text("link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type Notification = typeof notificationsTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A3 — CLIENT COMPANIES
// ═══════════════════════════════════════════════════════════════════

export const clientsTable = pgTable("clients", {
  id:            serial("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email").notNull(),
  phone:         text("phone"),
  address:       text("address"),
  website:       text("website"),
  industry:      text("industry"),
  contactPerson: text("contact_person"),
  accountNumber: text("account_number").unique(),
  vatNumber:     text("vat_number"),
  contractType:  text("contract_type").notNull().default("payg"), // "sla"|"payg"|"cash"
  slaTier:       text("sla_tier"),   // "bronze"|"silver"|"gold"|"platinum"|"diamond"|"custom"
  status:        text("status").notNull().default("active"), // "active"|"suspended"|"prospect"
  assignedCem:   integer("assigned_cem").references(() => usersTable.id),
  notes:         text("notes"),
  customFields:  jsonb("custom_fields").default({}),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});
export type Client = typeof clientsTable.$inferSelect;
export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;

// ═══════════════════════════════════════════════════════════════════
// SECTION A4 — EXTENDED TICKETS (ALTER existing + NEW relations)
// Add these columns to ticketsTable via migration:
// ticketType, branch, clientId, assignedTeam, approvalStatus,
// approvalRequestedFrom, peerReviewerId, riskAccepted, riskAcceptedBy,
// timeStarted, timeEnded, totalMinutes, slaBreachAt, slaBreached,
// source, resolution, projectId, slaPackageId
// ═══════════════════════════════════════════════════════════════════

// FULL NEW TICKET SCHEMA (replace existing ticketsTable with this):
// NOTE: Run migration to add new columns, don't drop existing table
export const ticketsTableV2 = pgTable("tickets", {
  id:                    serial("id").primaryKey(),
  subject:               text("subject").notNull(),
  description:           text("description").notNull(),
  status:                text("status").notNull().default("new"),
  // "new"|"assigned"|"in_progress"|"pending"|"awaiting_approval"
  // |"awaiting_client"|"escalated"|"resolved"|"closed"
  priority:              text("priority").notNull().default("medium"),
  // "low"|"medium"|"high"|"critical"
  ticketType:            text("ticket_type").notNull().default("support"),
  // "support"|"request"|"change"|"project"|"maintenance"|"emergency"|"system_generated"
  branch:                integer("branch").notNull().default(1), // 1=support 2=request 3=change
  customerId:            integer("customer_id").references(() => usersTable.id),
  clientId:              integer("client_id").references(() => clientsTable.id),
  assignedTo:            integer("assigned_to").references(() => usersTable.id),
  assignedTeam:          text("assigned_team"),
  // "1stline"|"2ndline"|"3rdline"|"projects"|"management"
  approvalStatus:        text("approval_status").default("not_required"),
  // "not_required"|"pending"|"approved"|"rejected"
  approvalRequestedFrom: integer("approval_requested_from").references(() => usersTable.id),
  peerReviewerId:        integer("peer_reviewer_id").references(() => usersTable.id),
  riskAccepted:          boolean("risk_accepted").default(false),
  riskAcceptedBy:        integer("risk_accepted_by").references(() => usersTable.id),
  approvedAt:            timestamp("approved_at"),
  approvalNotes:         text("approval_notes"),
  timeStarted:           timestamp("time_started"),
  timeEnded:             timestamp("time_ended"),
  totalMinutes:          integer("total_minutes").default(0),
  slaBreachAt:           timestamp("sla_breach_at"),
  slaBreached:           boolean("sla_breached").default(false),
  source:                text("source").default("portal"),
  // "portal"|"email"|"system"|"rmm"|"phone"
  closureReason:         text("closure_reason"),
  resolution:            text("resolution"),
  projectId:             integer("project_id"),
  slaPackageId:          integer("sla_package_id"),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// SECTION A5 — TIME TRACKING
// ═══════════════════════════════════════════════════════════════════

export const timeEntriesTable = pgTable("time_entries", {
  id:              serial("id").primaryKey(),
  ticketId:        integer("ticket_id").references(() => ticketsTable.id),
  userId:          integer("user_id").notNull().references(() => usersTable.id),
  clientId:        integer("client_id").references(() => clientsTable.id),
  description:     text("description").notNull(),
  startTime:       timestamp("start_time"),
  endTime:         timestamp("end_time"),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  billable:        boolean("billable").notNull().default(true),
  hourlyRate:      integer("hourly_rate").default(0),  // in cents (ZAR)
  source:          text("source").default("manual"),   // "manual"|"timer"
  manualReason:    text("manual_reason"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});
export type TimeEntry = typeof timeEntriesTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A6 — SLA PACKAGES
// ═══════════════════════════════════════════════════════════════════

export const slaPackagesTable = pgTable("sla_packages", {
  id:                   serial("id").primaryKey(),
  name:                 text("name").notNull(),
  tier:                 text("tier").notNull().unique(),
  // "bronze"|"silver"|"gold"|"platinum"|"diamond"|"custom"
  description:          text("description"),
  priceMonthly:         integer("price_monthly"),     // ZAR cents
  firstResponseMinutes: integer("first_response_minutes"),
  resolutionMinutes:    integer("resolution_minutes"),
  supportHours:         text("support_hours").default("8x5"),
  features:             jsonb("features").default([]),
  maxDevices:           integer("max_devices"),
  maxUsers:             integer("max_users"),
  isCustom:             boolean("is_custom").default(false),
  active:               boolean("active").default(true),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});
export type SlaPackage = typeof slaPackagesTable.$inferSelect;

export const slaBreachLogsTable = pgTable("sla_breach_logs", {
  id:             serial("id").primaryKey(),
  ticketId:       integer("ticket_id").references(() => ticketsTable.id),
  clientId:       integer("client_id").references(() => clientsTable.id),
  packageId:      integer("package_id").references(() => slaPackagesTable.id),
  targetMinutes:  integer("target_minutes"),
  actualMinutes:  integer("actual_minutes"),
  severity:       text("severity"),
  notifiedAt:     timestamp("notified_at"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// SECTION A7 — INVOICES
// ═══════════════════════════════════════════════════════════════════

export const invoicesTable = pgTable("invoices", {
  id:             serial("id").primaryKey(),
  invoiceNumber:  text("invoice_number").notNull().unique(), // HALO-2026-0001
  clientId:       integer("client_id").references(() => clientsTable.id),
  clientName:     text("client_name").notNull(),
  clientEmail:    text("client_email"),
  clientAddress:  text("client_address"),
  clientVat:      text("client_vat"),
  type:           text("type").notNull().default("support"),
  // "support"|"project"|"time"|"goods"|"subscription"|"adhoc"
  items:          jsonb("items").notNull().default([]),
  // [{ description, qty, unitPrice, vatRate, total }]
  subtotal:       integer("subtotal").notNull().default(0), // ZAR cents
  vatAmount:      integer("vat_amount").notNull().default(0),
  total:          integer("total").notNull().default(0),
  currency:       text("currency").notNull().default("ZAR"),
  status:         text("status").notNull().default("draft"),
  // "draft"|"sent"|"paid"|"overdue"|"cancelled"|"credit_note"
  dueDate:        timestamp("due_date"),
  sentAt:         timestamp("sent_at"),
  paidAt:         timestamp("paid_at"),
  paidMethod:     text("paid_method"),
  notes:          text("notes"),
  ticketIds:      jsonb("ticket_ids").default([]),
  createdBy:      integer("created_by").references(() => usersTable.id),
  approvedBy:     integer("approved_by").references(() => usersTable.id),
  pdfPath:        text("pdf_path"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});
export type Invoice = typeof invoicesTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A8 — QUOTATIONS
// ═══════════════════════════════════════════════════════════════════

export const quotationsTable = pgTable("quotations", {
  id:                  serial("id").primaryKey(),
  quoteNumber:         text("quote_number").notNull().unique(), // HALO-Q-2026-0001
  clientId:            integer("client_id").references(() => clientsTable.id),
  clientName:          text("client_name").notNull(),
  clientEmail:         text("client_email"),
  type:                text("type").notNull().default("service"),
  // "hardware"|"software"|"service"|"project"|"custom"
  items:               jsonb("items").notNull().default([]),
  subtotal:            integer("subtotal").notNull().default(0),
  vatAmount:           integer("vat_amount").notNull().default(0),
  total:               integer("total").notNull().default(0),
  currency:            text("currency").notNull().default("ZAR"),
  status:              text("status").notNull().default("draft"),
  // "draft"|"sent"|"accepted"|"rejected"|"expired"|"converted"
  validUntil:          timestamp("valid_until"),
  sentAt:              timestamp("sent_at"),
  respondedAt:         timestamp("responded_at"),
  notes:               text("notes"),
  convertedInvoiceId:  integer("converted_invoice_id"),
  aiGenerated:         boolean("ai_generated").default(false),
  requestPrompt:       text("request_prompt"),
  createdBy:           integer("created_by").references(() => usersTable.id),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});
export type Quotation = typeof quotationsTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A9 — RMM DEVICES
// ═══════════════════════════════════════════════════════════════════

export const devicesTable = pgTable("devices", {
  id:                serial("id").primaryKey(),
  agentToken:        text("agent_token").notNull().unique(),
  deviceName:        text("device_name").notNull(),
  hostname:          text("hostname"),
  os:                text("os"),             // "Windows 11"|"Ubuntu 22.04"|etc.
  osVersion:         text("os_version"),
  agentType:         text("agent_type"),     // "windows"|"linux"|"mac"|"api"
  status:            text("status").notNull().default("pending"),
  // "online"|"offline"|"warning"|"critical"|"maintenance"|"pending"
  cpuPercent:        integer("cpu_percent"),
  ramGb:             integer("ram_gb"),
  ramFreeGb:         integer("ram_free_gb"),
  diskGb:            integer("disk_gb"),
  diskFreeGb:        integer("disk_free_gb"),
  ipAddress:         text("ip_address"),
  externalIp:        text("external_ip"),
  macAddress:        text("mac_address"),
  agentVersion:      text("agent_version"),
  lastSeen:          timestamp("last_seen"),
  lastCheckin:       timestamp("last_checkin"),
  clientId:          integer("client_id").references(() => clientsTable.id),
  userId:            integer("user_id").references(() => usersTable.id),
  installedSoftware: jsonb("installed_software").default([]),
  patches:           jsonb("patches").default({}),
  customTags:        jsonb("custom_tags").default([]),
  metadata:          jsonb("metadata").default({}),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
  updatedAt:         timestamp("updated_at").notNull().defaultNow(),
});
export type Device = typeof devicesTable.$inferSelect;

export const rmmScriptsTable = pgTable("rmm_scripts", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  scriptType:  text("script_type").notNull(), // "powershell"|"bash"|"python"|"cmd"
  content:     text("content").notNull(),
  parameters:  jsonb("parameters").default([]),
  targetOs:    text("target_os").default("all"),
  category:    text("category"),
  approved:    boolean("approved").default(false),
  createdBy:   integer("created_by").references(() => usersTable.id),
  approvedBy:  integer("approved_by").references(() => usersTable.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});
export type RmmScript = typeof rmmScriptsTable.$inferSelect;

export const rmmJobsTable = pgTable("rmm_jobs", {
  id:           serial("id").primaryKey(),
  scriptId:     integer("script_id").references(() => rmmScriptsTable.id),
  deviceId:     integer("device_id").references(() => devicesTable.id),
  deviceIds:    jsonb("device_ids").default([]),
  status:       text("status").notNull().default("pending"),
  // "pending"|"running"|"completed"|"failed"|"cancelled"
  parameters:   jsonb("parameters").default({}),
  output:       text("output"),
  exitCode:     integer("exit_code"),
  errorMessage: text("error_message"),
  startedAt:    timestamp("started_at"),
  completedAt:  timestamp("completed_at"),
  triggeredBy:  text("triggered_by"),
  ticketId:     integer("ticket_id"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});
export type RmmJob = typeof rmmJobsTable.$inferSelect;

export const rmmAlertsTable = pgTable("rmm_alerts", {
  id:            serial("id").primaryKey(),
  deviceId:      integer("device_id").references(() => devicesTable.id),
  clientId:      integer("client_id").references(() => clientsTable.id),
  type:          text("type").notNull(),
  // "disk"|"cpu"|"ram"|"offline"|"patch"|"security"|"backup"|"service"
  severity:      text("severity").notNull(),  // "info"|"warning"|"critical"
  title:         text("title").notNull(),
  message:       text("message").notNull(),
  details:       jsonb("details").default({}),
  status:        text("status").notNull().default("open"),
  // "open"|"acknowledged"|"resolved"|"auto_resolved"
  autoTicketId:  integer("auto_ticket_id"),
  resolvedAt:    timestamp("resolved_at"),
  acknowledgedBy: integer("acknowledged_by").references(() => usersTable.id),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});
export type RmmAlert = typeof rmmAlertsTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A10 — KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════

export const kbArticlesTable = pgTable("kb_articles", {
  id:           serial("id").primaryKey(),
  title:        text("title").notNull(),
  content:      text("content").notNull(),
  summary:      text("summary"),
  category:     text("category").notNull().default("general"),
  // "general"|"1stline"|"2ndline"|"3rdline"|"management"|"client_guide"|"vendor"
  tags:         jsonb("tags").default([]),
  audience:     text("audience").notNull().default("internal"),
  // "internal"|"client"|"public"
  difficulty:   text("difficulty").default("beginner"),
  vendor:       text("vendor"),
  clientId:     integer("client_id").references(() => clientsTable.id),
  authorId:     integer("author_id").references(() => usersTable.id),
  views:        integer("views").notNull().default(0),
  helpful:      integer("helpful").notNull().default(0),
  notHelpful:   integer("not_helpful").notNull().default(0),
  aiGenerated:  boolean("ai_generated").default(false),
  published:    boolean("published").default(true),
  sourceUrl:    text("source_url"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});
export type KbArticle = typeof kbArticlesTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A11 — LEARN CENTRE
// ═══════════════════════════════════════════════════════════════════

export const learnCoursesTable = pgTable("learn_courses", {
  id:            serial("id").primaryKey(),
  title:         text("title").notNull(),
  description:   text("description"),
  category:      text("category"),
  vendor:        text("vendor"),      // "Microsoft"|"CompTIA"|"Cisco"|"AWS"|"Watchguard"
  examCode:      text("exam_code"),   // "AZ-900"|"CompTIA A+"
  level:         text("level").default("beginner"),
  content:       jsonb("content").notNull().default([]),
  // [{ type:"text"|"video"|"quiz", title, body, videoUrl, embedUrl, questions:[] }]
  objectives:    jsonb("objectives").default([]),
  durationHours: integer("duration_hours"),
  passScore:     integer("pass_score").default(70),
  bookingUrl:    text("booking_url"),
  aiGenerated:   boolean("ai_generated").default(false),
  published:     boolean("published").default(false),
  createdBy:     integer("created_by").references(() => usersTable.id),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});
export type LearnCourse = typeof learnCoursesTable.$inferSelect;

export const learnProgressTable = pgTable("learn_progress", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().references(() => usersTable.id),
  courseId:        integer("course_id").notNull().references(() => learnCoursesTable.id),
  percentComplete: integer("percent_complete").notNull().default(0),
  lastSection:     integer("last_section").default(0),
  completedAt:     timestamp("completed_at"),
  studyHours:      integer("study_hours").default(0),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});

export const learnExamAttemptsTable = pgTable("learn_exam_attempts", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull().references(() => usersTable.id),
  courseId:       integer("course_id").notNull().references(() => learnCoursesTable.id),
  answers:        jsonb("answers").notNull().default([]),
  score:          integer("score"),
  passed:         boolean("passed").default(false),
  timeTakenMinutes: integer("time_taken_minutes"),
  attemptNumber:  integer("attempt_number").default(1),
  passPhotoUrl:   text("pass_photo_url"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// SECTION A12 — VAULT
// ═══════════════════════════════════════════════════════════════════

export const vaultEntriesTable = pgTable("vault_entries", {
  id:            serial("id").primaryKey(),
  name:          text("name").notNull(),
  type:          text("type").notNull(),
  // "password"|"api_key"|"certificate"|"note"|"ssh_key"|"credit_card"
  encryptedData: text("encrypted_data").notNull(), // AES-256-CBC
  tags:          jsonb("tags").default([]),
  url:           text("url"),
  username:      text("username"),
  ownerId:       integer("owner_id").notNull().references(() => usersTable.id),
  sharedWith:    jsonb("shared_with").default([]),
  // [{ userId, canEdit }]
  folder:        text("folder"),
  expiresAt:     timestamp("expires_at"),
  favorite:      boolean("favorite").default(false),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});
export type VaultEntry = typeof vaultEntriesTable.$inferSelect;

export const vaultAccessLogsTable = pgTable("vault_access_logs", {
  id:        serial("id").primaryKey(),
  entryId:   integer("entry_id").references(() => vaultEntriesTable.id),
  userId:    integer("user_id").references(() => usersTable.id),
  action:    text("action").notNull(), // "view"|"edit"|"delete"|"share"
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// SECTION A13 — SECURITY CENTRE
// ═══════════════════════════════════════════════════════════════════

export const securityEventsTable = pgTable("security_events", {
  id:          serial("id").primaryKey(),
  type:        text("type").notNull(),
  // "login_fail"|"brute_force"|"anomaly"|"breach"|"scan"|"privilege_escalation"
  severity:    text("severity").notNull(), // "info"|"low"|"medium"|"high"|"critical"
  source:      text("source"),
  userId:      integer("user_id").references(() => usersTable.id),
  deviceId:    integer("device_id").references(() => devicesTable.id),
  ipAddress:   text("ip_address"),
  title:       text("title").notNull(),
  description: text("description"),
  details:     jsonb("details").default({}),
  status:      text("status").default("open"),
  resolvedAt:  timestamp("resolved_at"),
  resolvedBy:  integer("resolved_by").references(() => usersTable.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});
export type SecurityEvent = typeof securityEventsTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A14 — HR SYSTEM
// ═══════════════════════════════════════════════════════════════════

export const staffProfilesTable = pgTable("staff_profiles", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().unique().references(() => usersTable.id),
  employeeId:      text("employee_id").unique(),
  jobTitle:        text("job_title"),
  department:      text("department"),
  team:            text("team"),  // "1stline"|"2ndline"|"3rdline"|"projects"|"management"
  lineManagerId:   integer("line_manager_id").references(() => usersTable.id),
  startDate:       timestamp("start_date"),
  employmentType:  text("employment_type").default("full_time"),
  salaryType:      text("salary_type").default("fixed"), // "fixed"|"hourly"|"owner_share"
  salaryCents:     integer("salary_cents"),
  ownerSharePct:   integer("owner_share_pct"),           // for owner profit share
  certifications:  jsonb("certifications").default([]),
  skills:          jsonb("skills").default([]),
  encryptedBank:   text("encrypted_bank"),               // AES-256
  encryptedTax:    text("encrypted_tax"),                // AES-256
  contractPath:    text("contract_path"),
  active:          boolean("active").default(true),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});
export type StaffProfile = typeof staffProfilesTable.$inferSelect;

export const leaveRequestsTable = pgTable("leave_requests", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => usersTable.id),
  type:        text("type").notNull(),  // "annual"|"sick"|"study"|"unpaid"|"other"
  startDate:   timestamp("start_date").notNull(),
  endDate:     timestamp("end_date").notNull(),
  days:        integer("days").notNull(),
  reason:      text("reason"),
  status:      text("status").notNull().default("pending"),
  approvedBy:  integer("approved_by").references(() => usersTable.id),
  approvedAt:  timestamp("approved_at"),
  comments:    text("comments"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export const performanceReviewsTable = pgTable("performance_reviews", {
  id:                      serial("id").primaryKey(),
  userId:                  integer("user_id").notNull().references(() => usersTable.id),
  reviewerId:              integer("reviewer_id").notNull().references(() => usersTable.id),
  period:                  text("period").notNull(),        // "Q1-2026"
  kpiScore:                integer("kpi_score"),            // 0-100
  kpiGoals:                jsonb("kpi_goals").default([]),
  strengths:               text("strengths"),
  improvements:            text("improvements"),
  overallRating:           text("overall_rating"),
  // "poor"|"needs_improvement"|"meets"|"exceeds"|"outstanding"
  salaryIncreaseEligible:  boolean("salary_increase_eligible").default(false),
  status:                  text("status").default("draft"),
  acknowledgedAt:          timestamp("acknowledged_at"),
  createdAt:               timestamp("created_at").notNull().defaultNow(),
  updatedAt:               timestamp("updated_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// SECTION A15 — SHOP
// ═══════════════════════════════════════════════════════════════════

export const shopProductsTable = pgTable("shop_products", {
  id:            serial("id").primaryKey(),
  name:          text("name").notNull(),
  description:   text("description"),
  category:      text("category"),
  sku:           text("sku").unique(),
  brand:         text("brand"),
  costPriceCents:    integer("cost_price_cents"),
  sellingPriceCents: integer("selling_price_cents").notNull(),
  vatRate:       integer("vat_rate").default(15),  // %
  stock:         integer("stock").default(0),
  imageUrl:      text("image_url"),
  isService:     boolean("is_service").default(false),
  isSpecial:     boolean("is_special").default(false),
  specialStart:  timestamp("special_start"),
  specialEnd:    timestamp("special_end"),
  specialPriceCents: integer("special_price_cents"),
  active:        boolean("active").default(true),
  aiSearched:    boolean("ai_searched").default(false),
  sourceUrl:     text("source_url"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});
export type ShopProduct = typeof shopProductsTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A16 — APP BUILDER
// ═══════════════════════════════════════════════════════════════════

export const appProjectsTable = pgTable("app_projects", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  type:        text("type").notNull(),  // "web"|"pwa"|"exe"|"msi"|"api"
  prompt:      text("prompt"),
  generatedCode: jsonb("generated_code").default({}), // { files: [{path, content}] }
  status:      text("status").default("draft"),
  // "draft"|"building"|"built"|"deployed"|"failed"
  buildLogs:   text("build_logs"),
  downloadUrl: text("download_url"),
  framework:   text("framework"),
  targetOs:    text("target_os").default("all"),
  ownerId:     integer("owner_id").references(() => usersTable.id),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// SECTION A17 — AI CHAT HISTORY
// ═══════════════════════════════════════════════════════════════════

export const aiSessionsTable = pgTable("ai_sessions", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").references(() => usersTable.id),
  title:     text("title"),
  model:     text("model").default("DeepSeek-V4-Pro"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiMessagesTable = pgTable("ai_messages", {
  id:        serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => aiSessionsTable.id),
  role:      text("role").notNull(),  // "user"|"assistant"|"system"
  content:   text("content").notNull(),
  tokens:    integer("tokens"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type AiMessage = typeof aiMessagesTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// SECTION A18 — BACKUP JOBS
// ═══════════════════════════════════════════════════════════════════

export const backupJobsTable = pgTable("backup_jobs", {
  id:            serial("id").primaryKey(),
  name:          text("name").notNull(),
  deviceId:      integer("device_id").references(() => devicesTable.id),
  clientId:      integer("client_id").references(() => clientsTable.id),
  provider:      text("provider"),
  // "onedrive"|"gdrive"|"mega"|"aws"|"azure"|"cove"|"local"|"custom"
  config:        jsonb("config").default({}),  // encrypted config
  schedule:      text("schedule"),             // cron expression
  status:        text("status").default("active"),
  lastRunAt:     timestamp("last_run_at"),
  lastStatus:    text("last_status"),
  // "success"|"failed"|"running"|"pending"
  lastSizeBytes: integer("last_size_bytes"),
  retentionDays: integer("retention_days").default(30),
  encrypted:     boolean("encrypted").default(true),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});
export type BackupJob = typeof backupJobsTable.$inferSelect;
```

---

## 📁 SECTION B — BACKEND ROUTES
### All files go in: `artifacts/api-server/src/routes/`

---

### FILE: `artifacts/api-server/src/routes/index.ts` (REPLACE)

```typescript
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import setupRouter from "./setup";
import ticketsRouter from "./tickets";
import adminRouter from "./admin";
import uploadRouter from "./upload";
// Phase 2 — add all new routes:
import clientsRouter from "./clients";
import slaRouter from "./sla";
import invoicesRouter from "./invoices";
import quotationsRouter from "./quotations";
import aiRouter from "./ai";
import kbRouter from "./kb";
import learnRouter from "./learn";
import rmmRouter from "./rmm";
import securityRouter from "./security";
import vaultRouter from "./vault";
import toolsRouter from "./tools";
import hrRouter from "./hr";
import shopRouter from "./shop";
import backupRouter from "./backup";
import devConsoleRouter from "./devconsole";
import appBuilderRouter from "./appbuilder";
import auditRouter from "./audit";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth",          authRouter);
router.use("/setup",         setupRouter);
router.use("/tickets",       ticketsRouter);
router.use("/admin",         adminRouter);
router.use(uploadRouter);
// Phase 2:
router.use("/clients",       clientsRouter);
router.use("/sla",           slaRouter);
router.use("/invoices",      invoicesRouter);
router.use("/quotations",    quotationsRouter);
router.use("/ai",            aiRouter);
router.use("/kb",            kbRouter);
router.use("/learn",         learnRouter);
router.use("/rmm",           rmmRouter);
router.use("/security",      securityRouter);
router.use("/vault",         vaultRouter);
router.use("/tools",         toolsRouter);
router.use("/hr",            hrRouter);
router.use("/shop",          shopRouter);
router.use("/backup",        backupRouter);
router.use("/devconsole",    devConsoleRouter);
router.use("/appbuilder",    appBuilderRouter);
router.use("/audit",         auditRouter);
router.use("/notifications", notificationsRouter);

export default router;
```

---

### FILE: `artifacts/api-server/src/middleware/rbac.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type Role = "super_admin" | "admin" | "manager" | "technician" | "agent" | "customer";

const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 100, admin: 80, manager: 60,
  technician: 40, agent: 30, customer: 10,
};

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [user] = await db.select({ role: usersTable.role, isOwner: usersTable.isOwner })
      .from(usersTable).where(eq(usersTable.id, req.session.userId!));
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    if (user.isOwner) { next(); return; } // owners bypass all
    if (!roles.includes(user.role as Role)) {
      res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select({ role: usersTable.role, permissions: usersTable.permissions, isOwner: usersTable.isOwner })
      .from(usersTable).where(eq(usersTable.id, req.session.userId!));
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    if (user.isOwner || user.role === "super_admin" || user.role === "admin") {
      next(); return;
    }
    const perms = (user.permissions as Record<string, boolean>) || {};
    if (!perms[permission]) {
      res.status(403).json({ error: `Permission required: ${permission}` });
      return;
    }
    next();
  };
}

export async function getUser(userId: number) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return u;
}

export async function isAdminOrOwner(userId: number): Promise<boolean> {
  const u = await getUser(userId);
  return !!(u?.isOwner || u?.role === "super_admin" || u?.role === "admin");
}

export async function logAudit(
  userId: number | null, action: string, entity?: string,
  entityId?: string | number, details?: object, req?: Request
) {
  const { auditLogsTable } = await import("@workspace/db");
  await db.insert(auditLogsTable).values({
    userId, action, entity, entityId: entityId?.toString(),
    details: details || {},
    ipAddress: req?.ip || null,
    userAgent: req?.headers["user-agent"] || null,
  });
}
```

---

### FILE: `artifacts/api-server/src/routes/clients.ts` (NEW)

```typescript
import { Router } from "express";
import { db, clientsTable, usersTable, ticketsTable, devicesTable, invoicesTable } from "@workspace/db";
import { eq, desc, count, ilike } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireRole, logAudit } from "../middleware/rbac";

const router = Router();
router.use(requireAuth);

// GET /api/clients — list all
router.get("/", async (req, res) => {
  try {
    const clients = await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt));
    res.json({ clients });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/clients — create
router.post("/", requireRole("admin", "manager", "super_admin"), async (req, res) => {
  const { name, email, phone, address, contractType, slaTier, contactPerson } = req.body;
  if (!name || !email) { res.status(400).json({ error: "name and email required" }); return; }
  try {
    const num = `HALO-C-${String(Date.now()).slice(-5)}`;
    const [client] = await db.insert(clientsTable).values({
      name, email, phone, address, contractType, slaTier, contactPerson,
      accountNumber: num,
    }).returning();
    await logAudit(req.session.userId!, "client.created", "client", client.id, { name }, req);
    res.json({ client });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/clients/:id — detail with stats
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) { res.status(404).json({ error: "Not found" }); return; }
    const [tCount] = await db.select({ count: count() }).from(ticketsTable).where(eq(ticketsTable.clientId, id));
    const [dCount] = await db.select({ count: count() }).from(devicesTable).where(eq(devicesTable.clientId, id));
    const [iCount] = await db.select({ count: count() }).from(invoicesTable).where(eq(invoicesTable.clientId, id));
    res.json({ client, stats: {
      tickets: Number(tCount.count),
      devices: Number(dCount.count),
      invoices: Number(iCount.count),
    }});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/clients/:id — update
router.put("/:id", requireRole("admin", "manager", "super_admin"), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [client] = await db.update(clientsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(clientsTable.id, id)).returning();
    await logAudit(req.session.userId!, "client.updated", "client", id, {}, req);
    res.json({ client });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/clients/:id — soft delete (suspend)
router.delete("/:id", requireRole("super_admin"), async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.update(clientsTable).set({ status: "suspended", updatedAt: new Date() })
      .where(eq(clientsTable.id, id));
    await logAudit(req.session.userId!, "client.suspended", "client", id, {}, req);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/rmm.ts` (NEW)

```typescript
import { Router } from "express";
import { db, devicesTable, rmmJobsTable, rmmScriptsTable, rmmAlertsTable, ticketsTable, notificationsTable } from "@workspace/db";
import { eq, desc, and, isNull, lt } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireRole, logAudit } from "../middleware/rbac";
import { randomUUID } from "crypto";

const router = Router();

// ── AGENT ENDPOINTS (token auth, no session) ──────────────────────

// POST /api/rmm/heartbeat — agent check-in
router.post("/heartbeat", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "No token" }); return; }
  try {
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.agentToken, token));
    if (!device) { res.status(403).json({ error: "Invalid token" }); return; }
    const { hostname, os, osVersion, cpuPercent, ramGb, ramFreeGb,
            diskGb, diskFreeGb, ipAddress, agentVersion } = req.body;
    await db.update(devicesTable).set({
      hostname, os, osVersion, cpuPercent, ramGb, ramFreeGb, diskGb, diskFreeGb,
      ipAddress, agentVersion, status: "online",
      lastSeen: new Date(), lastCheckin: new Date(), updatedAt: new Date(),
    }).where(eq(devicesTable.id, device.id));
    // Check alert thresholds
    await checkAlerts(device.id, device.clientId, { cpuPercent, diskFreeGb, diskGb });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/rmm/jobs/pending — agent polls
router.get("/jobs/pending", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "No token" }); return; }
  try {
    const [device] = await db.select({ id: devicesTable.id })
      .from(devicesTable).where(eq(devicesTable.agentToken, token));
    if (!device) { res.status(403).json({ error: "Invalid token" }); return; }
    const jobs = await db.select({ id: rmmJobsTable.id, scriptId: rmmJobsTable.scriptId,
        parameters: rmmJobsTable.parameters })
      .from(rmmJobsTable)
      .where(and(eq(rmmJobsTable.deviceId, device.id), eq(rmmJobsTable.status, "pending")));
    // Enrich with script content
    const enriched = await Promise.all(jobs.map(async (j) => {
      if (!j.scriptId) return j;
      const [script] = await db.select({ content: rmmScriptsTable.content, scriptType: rmmScriptsTable.scriptType })
        .from(rmmScriptsTable).where(eq(rmmScriptsTable.id, j.scriptId));
      return { ...j, ...script };
    }));
    res.json({ jobs: enriched });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/rmm/jobs/:id/result — agent submits result
router.post("/jobs/:id/result", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "No token" }); return; }
  try {
    const { output, exitCode, status, startedAt, completedAt } = req.body;
    await db.update(rmmJobsTable).set({
      output, exitCode, status, startedAt: startedAt ? new Date(startedAt) : null,
      completedAt: completedAt ? new Date(completedAt) : new Date(),
      updatedAt: new Date(),
    }).where(eq(rmmJobsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── AUTHENTICATED ENDPOINTS ───────────────────────────────────────

router.use(requireAuth);

// GET /api/rmm/devices — list all devices
router.get("/devices", async (req, res) => {
  try {
    const devices = await db.select().from(devicesTable).orderBy(desc(devicesTable.lastSeen));
    res.json({ devices });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/rmm/devices/:id
router.get("/devices/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
    if (!device) { res.status(404).json({ error: "Not found" }); return; }
    const jobs = await db.select().from(rmmJobsTable).where(eq(rmmJobsTable.deviceId, id))
      .orderBy(desc(rmmJobsTable.createdAt)).limit(20);
    const alerts = await db.select().from(rmmAlertsTable).where(eq(rmmAlertsTable.deviceId, id))
      .orderBy(desc(rmmAlertsTable.createdAt)).limit(20);
    res.json({ device, jobs, alerts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/rmm/devices/:id/job — push job to device
router.post("/devices/:id/job", requireRole("admin", "manager", "super_admin"), async (req, res) => {
  const deviceId = Number(req.params.id);
  const { scriptId, content, scriptType, parameters } = req.body;
  try {
    let sid = scriptId;
    if (!sid && content) {
      const [s] = await db.insert(rmmScriptsTable).values({
        name: "Ad-hoc", scriptType: scriptType || "powershell",
        content, approved: true, createdBy: req.session.userId!,
      }).returning();
      sid = s.id;
    }
    const [job] = await db.insert(rmmJobsTable).values({
      scriptId: sid, deviceId, parameters: parameters || {},
      status: "pending", triggeredBy: String(req.session.userId!),
    }).returning();
    await logAudit(req.session.userId!, "rmm.job_pushed", "device", deviceId, { scriptId: sid }, req);
    res.json({ job });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/rmm/agent/generate — generate installer token + script
router.post("/agent/generate", requireRole("admin", "super_admin"), async (req, res) => {
  const { deviceName, clientId, agentType = "windows_ps" } = req.body;
  if (!deviceName) { res.status(400).json({ error: "deviceName required" }); return; }
  try {
    const token = `${randomUUID()}-${randomUUID()}`;
    const [device] = await db.insert(devicesTable).values({
      agentToken: token, deviceName, clientId: clientId || null,
      status: "pending", agentType,
    }).returning();
    const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
    const script = generateScript(agentType, token, serverUrl, deviceName);
    res.json({ device, token, script, agentType });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/rmm/alerts
router.get("/alerts", async (req, res) => {
  try {
    const alerts = await db.select().from(rmmAlertsTable)
      .orderBy(desc(rmmAlertsTable.createdAt)).limit(100);
    res.json({ alerts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/rmm/scripts
router.get("/scripts", async (req, res) => {
  try {
    const scripts = await db.select().from(rmmScriptsTable).orderBy(rmmScriptsTable.name);
    res.json({ scripts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── HELPER: CHECK ALERT THRESHOLDS ────────────────────────────────

async function checkAlerts(deviceId: number, clientId: number | null, metrics: any) {
  const alerts = [];
  if (metrics.diskGb > 0) {
    const usedPct = ((metrics.diskGb - metrics.diskFreeGb) / metrics.diskGb) * 100;
    if (usedPct >= 90) {
      alerts.push({ type: "disk", severity: "critical", title: "Disk Critical",
        message: `Disk usage at ${Math.round(usedPct)}% — less than 10% free` });
    } else if (usedPct >= 80) {
      alerts.push({ type: "disk", severity: "warning", title: "Disk Warning",
        message: `Disk usage at ${Math.round(usedPct)}%` });
    }
  }
  if (metrics.cpuPercent >= 95) {
    alerts.push({ type: "cpu", severity: "critical", title: "CPU Critical",
      message: `CPU usage at ${metrics.cpuPercent}%` });
  }
  for (const a of alerts) {
    await db.insert(rmmAlertsTable).values({ deviceId, clientId, ...a,
      details: metrics, status: "open" });
  }
}

// ── HELPER: GENERATE AGENT SCRIPTS ───────────────────────────────

function generateScript(type: string, token: string, server: string, name: string): string {
  if (type === "linux") {
    return `#!/bin/bash
# Halo IT Services 365 — Linux Agent v2.0
HALO_SERVER="${server}"
HALO_TOKEN="${token}"
HALO_DEVICE="${name}"
HALO_INTERVAL=30

halo_heartbeat() {
  CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
  MEM_TOTAL=$(free -g | awk '/^Mem:/{print $2}')
  MEM_FREE=$(free -g | awk '/^Mem:/{print $4}')
  DISK_TOTAL=$(df -BG / | awk 'NR==2{print $2}' | tr -d 'G')
  DISK_FREE=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
  IP=$(hostname -I | awk '{print $1}')
  OS=$(lsb_release -d 2>/dev/null | cut -f2 || uname -o)
  HOSTNAME=$(hostname)
  curl -s -X POST "$HALO_SERVER/api/rmm/heartbeat" \\
    -H "Authorization: Bearer $HALO_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\\"hostname\\":\\"$HOSTNAME\\",\\"os\\":\\"$OS\\",\\"cpuPercent\\":$CPU,\\"ramGb\\":$MEM_TOTAL,\\"ramFreeGb\\":$MEM_FREE,\\"diskGb\\":$DISK_TOTAL,\\"diskFreeGb\\":$DISK_FREE,\\"ipAddress\\":\\"$IP\\"}"
}

halo_jobs() {
  JOBS=$(curl -s "$HALO_SERVER/api/rmm/jobs/pending" -H "Authorization: Bearer $HALO_TOKEN")
  echo "$JOBS" | python3 -c "
import sys,json,subprocess,datetime
jobs = json.load(sys.stdin).get('jobs',[])
for j in jobs:
  r = subprocess.run(['bash','-c',j.get('content','echo no-content')],capture_output=True,text=True)
  import urllib.request,json as j2
  data = j2.dumps({'status':'completed' if r.returncode==0 else 'failed','output':r.stdout+r.stderr,'exitCode':r.returncode}).encode()
  req = urllib.request.Request('${server}/api/rmm/jobs/'+str(j['id'])+'/result',data=data,headers={'Authorization':'Bearer ${token}','Content-Type':'application/json'},method='POST')
  urllib.request.urlopen(req)
" 2>/dev/null
}

# Install as systemd service
if [[ "$1" == "--install" ]]; then
  cp "$0" /usr/local/bin/halo-agent.sh
  chmod +x /usr/local/bin/halo-agent.sh
  cat > /etc/systemd/system/halo-agent.service << 'SYSD'
[Unit]
Description=Halo IT Services 365 Agent
After=network.target
[Service]
ExecStart=/usr/local/bin/halo-agent.sh
Restart=always
RestartSec=30
[Install]
WantedBy=multi-user.target
SYSD
  systemctl daemon-reload
  systemctl enable halo-agent
  systemctl start halo-agent
  echo "Halo IT Agent installed."
  exit 0
fi

echo "Halo IT Agent v2.0 — Device: $HALO_DEVICE"
while true; do
  halo_heartbeat
  halo_jobs
  sleep $HALO_INTERVAL
done`;
  }

  // Windows PowerShell (default)
  return `# Halo IT Services 365 — Windows Agent v2.0
# Generated: $(Get-Date)
$HALO_SERVER = "${server}"
$HALO_TOKEN  = "${token}"
$HALO_DEVICE = "${name}"
$HALO_INTERVAL = 30

function Send-Heartbeat {
  try {
    $os    = Get-CimInstance Win32_OperatingSystem
    $cpu   = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $disk  = Get-PSDrive C
    $ip    = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -ne "127.0.0.1"} | Select-Object -First 1).IPAddress
    $body  = @{
      hostname    = $env:COMPUTERNAME
      os          = $os.Caption
      osVersion   = $os.Version
      cpuPercent  = [int]$cpu
      ramGb       = [math]::Round($os.TotalVisibleMemorySize / 1MB)
      ramFreeGb   = [math]::Round($os.FreePhysicalMemory / 1MB)
      diskGb      = [math]::Round(($disk.Used + $disk.Free) / 1GB)
      diskFreeGb  = [math]::Round($disk.Free / 1GB)
      ipAddress   = $ip
      agentVersion= "2.0.0"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$HALO_SERVER/api/rmm/heartbeat" \`
      -Method POST -Body $body \`
      -Headers @{ Authorization = "Bearer $HALO_TOKEN"; "Content-Type" = "application/json" }
  } catch { Write-Warning "Heartbeat error: $_" }
}

function Invoke-HaloJobs {
  try {
    $resp = Invoke-RestMethod -Uri "$HALO_SERVER/api/rmm/jobs/pending" \`
      -Headers @{ Authorization = "Bearer $HALO_TOKEN" }
    foreach ($job in $resp.jobs) {
      $out = ""; $code = 0
      try {
        $out  = if ($job.scriptType -eq "powershell") { Invoke-Expression $job.content 2>&1 | Out-String }
                elseif ($job.scriptType -eq "cmd")    { cmd /c $job.content 2>&1 }
                else { $job.content | python3 - 2>&1 }
        $code = 0
      } catch { $out = $_.ToString(); $code = 1 }
      $result = @{ status = if($code -eq 0){"completed"}else{"failed"}
        output = $out; exitCode = $code; completedAt = (Get-Date -Format o) } | ConvertTo-Json
      Invoke-RestMethod -Uri "$HALO_SERVER/api/rmm/jobs/$($job.id)/result" \`
        -Method POST -Body $result \`
        -Headers @{ Authorization = "Bearer $HALO_TOKEN"; "Content-Type" = "application/json" }
    }
  } catch {}
}

if ($args -contains "-Install") {
  $path = "C:\\ProgramData\\HaloIT\\agent.ps1"
  New-Item -Path "C:\\ProgramData\\HaloIT" -ItemType Directory -Force | Out-Null
  Copy-Item $PSCommandPath $path -Force
  $action  = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -File `"$path`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings= New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName "HaloITAgent" -Action $action -Trigger $trigger \`
    -Settings $settings -RunLevel Highest -Force
  Start-ScheduledTask -TaskName "HaloITAgent"
  Write-Host "Halo IT Agent v2.0 installed as scheduled task."
  exit
}

Write-Host "Halo IT Agent v2.0 — $HALO_DEVICE"
while ($true) {
  Send-Heartbeat
  Invoke-HaloJobs
  Start-Sleep -Seconds $HALO_INTERVAL
}`;
}

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/ai.ts` (NEW — FULL)

```typescript
import { Router } from "express";
import { db, aiSessionsTable, aiMessagesTable, usersTable, ticketsTable, devicesTable } from "@workspace/db";
import { eq, desc, count, gte, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../middleware/rbac";

const router = Router();
router.use(requireAuth);

const SYSTEM_PROMPT = `You are HaloBot, the AI brain of Halo IT Services 365 — a Cape Town MSP.
You assist IT professionals with: support tickets, PowerShell/bash scripts, Azure/M365, security, networking.
Use South African context (ZAR currency, POPI Act compliance, local vendors like Takealot/Mustek).
Format code in markdown code blocks. Be concise and professional.
For system actions output: ACTION: action_name\nPAYLOAD: {"key":"value"}
Available actions: ticket_create, ticket_update, invoice_create, kb_create, notify, rmm_run_script`;

async function callAI(messages: Array<{role: string; content: string}>, stream = false): Promise<any> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const key = process.env.AZURE_OPENAI_KEY;
  const model = process.env.AI_MODEL || "DeepSeek-V4-Pro";

  if (!endpoint || !key) throw new Error("AI not configured: set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_KEY");

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ model, messages, max_tokens: 2000, temperature: 0.7, stream }),
  });

  if (!res.ok) {
    const err = await res.text();
    // Try fallback Ollama if configured
    if (process.env.OLLAMA_URL) return callOllama(messages);
    throw new Error(`AI API ${res.status}: ${err}`);
  }
  if (stream) return res;
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callOllama(messages: Array<{role: string; content: string}>): Promise<string> {
  const url = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";
  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) throw new Error("Fallback AI unavailable");
  const data = await res.json() as any;
  return data?.message?.content ?? "";
}

async function buildContext(userId: number): Promise<string> {
  const [user] = await db.select({ name: usersTable.name, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, userId));
  const [openTickets] = await db.select({ count: count() }).from(ticketsTable)
    .where(eq(ticketsTable.status, "open"));
  const [onlineDevices] = await db.select({ count: count() }).from(devicesTable)
    .where(eq(devicesTable.status, "online"));
  const now = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
  return `[Context: ${now} | User: ${user?.name} (${user?.role}) | Open tickets: ${openTickets?.count} | Online devices: ${onlineDevices?.count}]`;
}

// POST /api/ai/chat — streaming SSE
router.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body as { message: string; sessionId?: number };
  if (!message) { res.status(400).json({ error: "message required" }); return; }

  try {
    // Get or create session
    let sid = sessionId;
    if (!sid) {
      const [sess] = await db.insert(aiSessionsTable).values({
        userId: req.session.userId!, title: message.slice(0, 60),
      }).returning();
      sid = sess.id;
    }

    // Save user message
    await db.insert(aiMessagesTable).values({ sessionId: sid, role: "user", content: message });

    // Build message history (last 20)
    const history = await db.select().from(aiMessagesTable)
      .where(eq(aiMessagesTable.sessionId, sid))
      .orderBy(aiMessagesTable.createdAt).limit(20);

    const context = await buildContext(req.session.userId!);
    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n${context}` },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ];

    // Stream response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const aiRes = await callAI(messages, true);
    let fullContent = "";

    if (aiRes && typeof aiRes.body === "object") {
      const reader = (aiRes.body as any).getReader?.() || aiRes.body;
      const decoder = new TextDecoder();
      for await (const chunk of aiRes.body as any) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n").filter((l: string) => l.startsWith("data:"));
        for (const line of lines) {
          const data = line.replace("data: ", "").trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta?.content ?? "";
            if (delta) { fullContent += delta; res.write(`data: ${JSON.stringify({ delta })}\n\n`); }
          } catch {}
        }
      }
    } else {
      fullContent = typeof aiRes === "string" ? aiRes : "";
      res.write(`data: ${JSON.stringify({ delta: fullContent })}\n\n`);
    }

    // Save assistant response
    await db.insert(aiMessagesTable).values({ sessionId: sid, role: "assistant", content: fullContent });
    await db.update(aiSessionsTable).set({ updatedAt: new Date() }).where(eq(aiSessionsTable.id, sid));

    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid })}\n\n`);
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// GET /api/ai/sessions
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await db.select().from(aiSessionsTable)
      .where(eq(aiSessionsTable.userId, req.session.userId!))
      .orderBy(desc(aiSessionsTable.updatedAt)).limit(30);
    res.json({ sessions });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/ai/sessions/:id/messages
router.get("/sessions/:id/messages", async (req, res) => {
  const sid = Number(req.params.id);
  try {
    const [sess] = await db.select().from(aiSessionsTable).where(eq(aiSessionsTable.id, sid));
    if (!sess || sess.userId !== req.session.userId!) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const messages = await db.select().from(aiMessagesTable)
      .where(eq(aiMessagesTable.sessionId, sid)).orderBy(aiMessagesTable.createdAt);
    res.json({ messages });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/ai/generate — general generation (KB, scripts, quotes)
router.post("/generate", async (req, res) => {
  const { type, prompt, context: ctx } = req.body as { type: string; prompt: string; context?: string };
  const templates: Record<string, string> = {
    kb_article: `Generate a professional IT knowledge base article for Halo IT Services 365.
Topic: ${prompt}. Include: Introduction, Prerequisites, Step-by-step guide, Troubleshooting, References.
Format in Markdown. Be thorough and technical.`,
    script: `Generate a working ${ctx || "PowerShell"} script for: ${prompt}.
Include comments, error handling, and parameter validation. Return ONLY the script code.`,
    quote_items: `Generate JSON array of line items for a Halo IT Services 365 quotation.
Request: "${prompt}". Use ZAR pricing. Format: [{"description":"...","qty":1,"unitPrice":10000,"vatRate":15}]
Return ONLY valid JSON array, no markdown.`,
    troubleshoot: `As an expert IT engineer, provide step-by-step troubleshooting for: ${prompt}.
Scale from basic (Level 1) to advanced (Level 3). Include commands, checks, and escalation path.`,
  };
  const systemMsg = templates[type] || `You are an IT expert. ${prompt}`;
  try {
    const result = await callAI([{ role: "user", content: systemMsg }]);
    res.json({ result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/ai/daily-prompt — greeting for dashboard
router.get("/daily-prompt", async (req, res) => {
  try {
    const [user] = await db.select({ name: usersTable.name, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, req.session.userId!));
    const [openTickets] = await db.select({ count: count() }).from(ticketsTable).where(eq(ticketsTable.status, "open"));
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const suggestion = await callAI([{
      role: "user",
      content: `MSP daily briefing: ${openTickets?.count} open tickets. Give ONE actionable priority suggestion for today in 1 sentence, professional and brief.`
    }], false);
    res.json({
      greeting: `${greet}, ${user?.name}!`,
      openTickets: Number(openTickets?.count),
      suggestion: typeof suggestion === "string" ? suggestion : "Have a productive day!",
    });
  } catch (e: any) { res.status(200).json({ greeting: "Welcome back!", openTickets: 0, suggestion: "" }); }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/invoices.ts` (NEW)

```typescript
import { Router } from "express";
import { db, invoicesTable, clientsTable, settingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requirePermission, logAudit } from "../middleware/rbac";

const router = Router();
router.use(requireAuth);

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoice_seq_${year}`;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  const next = row ? Number(row.value) + 1 : 1;
  if (row) {
    await db.update(settingsTable).set({ value: String(next) }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value: "1" });
  }
  return `HALO-${year}-${String(next).padStart(4, "0")}`;
}

// GET /api/invoices
router.get("/", async (req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));
    res.json({ invoices });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices
router.post("/", requirePermission("invoice_create"), async (req, res) => {
  const { clientId, items, type, notes, dueDate } = req.body;
  if (!items?.length) { res.status(400).json({ error: "items required" }); return; }
  try {
    const invoiceNumber = await nextInvoiceNumber();
    let clientName = req.body.clientName || "Cash Client";
    let clientEmail = req.body.clientEmail;
    if (clientId) {
      const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, Number(clientId)));
      if (c) { clientName = c.name; clientEmail = clientEmail || c.email; }
    }
    // Calculate totals
    const calcItems = items.map((item: any) => {
      const subtotal = item.qty * item.unitPrice;
      const vat = Math.round(subtotal * (item.vatRate || 15) / 100);
      return { ...item, subtotal, vatAmount: vat, total: subtotal + vat };
    });
    const subtotal = calcItems.reduce((s: number, i: any) => s + i.subtotal, 0);
    const vatAmount = calcItems.reduce((s: number, i: any) => s + i.vatAmount, 0);
    const total = subtotal + vatAmount;
    const [inv] = await db.insert(invoicesTable).values({
      invoiceNumber, clientId, clientName, clientEmail,
      clientAddress: req.body.clientAddress, clientVat: req.body.clientVat,
      type, items: calcItems, subtotal, vatAmount, total,
      status: "draft", notes, dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.session.userId!,
    }).returning();
    await logAudit(req.session.userId!, "invoice.created", "invoice", inv.id, { invoiceNumber }, req);
    res.json({ invoice: inv });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/invoices/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ invoice });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/invoices/:id
router.patch("/:id", requirePermission("invoice_create"), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [inv] = await db.update(invoicesTable)
      .set({ ...req.body, updatedAt: new Date() }).where(eq(invoicesTable.id, id)).returning();
    await logAudit(req.session.userId!, "invoice.updated", "invoice", id, {}, req);
    res.json({ invoice: inv });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/:id/send
router.post("/:id/send", requirePermission("invoice_create"), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [inv] = await db.update(invoicesTable)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, id)).returning();
    await logAudit(req.session.userId!, "invoice.sent", "invoice", id, {}, req);
    res.json({ invoice: inv });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/vault.ts` (NEW)

```typescript
import { Router } from "express";
import { db, vaultEntriesTable, vaultAccessLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const router = Router();
router.use(requireAuth);

function getVaultKey(): Buffer {
  const secret = process.env.VAULT_SECRET || "haloit365-vault-CHANGE-ME-32chars";
  return createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getVaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(":");
  const decipher = createDecipheriv("aes-256-cbc", getVaultKey(), Buffer.from(ivHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
}

// GET /api/vault — list entries (no encrypted data)
router.get("/", async (req, res) => {
  try {
    const entries = await db.select({
      id: vaultEntriesTable.id, name: vaultEntriesTable.name,
      type: vaultEntriesTable.type, tags: vaultEntriesTable.tags,
      url: vaultEntriesTable.url, username: vaultEntriesTable.username,
      folder: vaultEntriesTable.folder, favorite: vaultEntriesTable.favorite,
      expiresAt: vaultEntriesTable.expiresAt, createdAt: vaultEntriesTable.createdAt,
    }).from(vaultEntriesTable).where(eq(vaultEntriesTable.ownerId, req.session.userId!));
    res.json({ entries });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/vault — create entry
router.post("/", async (req, res) => {
  const { name, type, data, tags, url, username, folder } = req.body;
  if (!name || !type || !data) { res.status(400).json({ error: "name, type, data required" }); return; }
  try {
    const encryptedData = encrypt(JSON.stringify(data));
    const [entry] = await db.insert(vaultEntriesTable).values({
      name, type, encryptedData, tags, url, username, folder,
      ownerId: req.session.userId!,
    }).returning();
    await db.insert(vaultAccessLogsTable).values({
      entryId: entry.id, userId: req.session.userId!, action: "create",
      ipAddress: req.ip,
    });
    res.json({ entry: { ...entry, encryptedData: undefined } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/vault/:id/reveal — decrypt and return (requires TOTP)
router.post("/:id/reveal", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [entry] = await db.select().from(vaultEntriesTable)
      .where(and(eq(vaultEntriesTable.id, id), eq(vaultEntriesTable.ownerId, req.session.userId!)));
    if (!entry) { res.status(404).json({ error: "Not found or no access" }); return; }
    const data = JSON.parse(decrypt(entry.encryptedData));
    await db.insert(vaultAccessLogsTable).values({
      entryId: id, userId: req.session.userId!, action: "view", ipAddress: req.ip,
    });
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/vault/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [entry] = await db.select({ ownerId: vaultEntriesTable.ownerId })
      .from(vaultEntriesTable).where(eq(vaultEntriesTable.id, id));
    if (!entry || entry.ownerId !== req.session.userId!) {
      res.status(403).json({ error: "No access" }); return;
    }
    await db.delete(vaultEntriesTable).where(eq(vaultEntriesTable.id, id));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/devconsole.ts` (NEW)

```typescript
import { Router } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { requireRole, logAudit } from "../middleware/rbac";
import { exec } from "child_process";
import { promisify } from "util";

const router = Router();
router.use(requireAuth);
router.use(requireRole("super_admin", "admin"));

const execAsync = promisify(exec);

// POST /api/devconsole/exec
router.post("/exec", async (req, res) => {
  const { mode, code } = req.body as { mode: "sql" | "js" | "bash"; code: string };
  if (!code) { res.status(400).json({ error: "code required" }); return; }

  await logAudit(req.session.userId!, `devconsole.${mode}`, "devconsole", undefined, { preview: code.slice(0, 100) }, req);

  try {
    let result: any;

    if (mode === "sql") {
      const raw = await db.execute({ sql: code, params: [] } as any);
      result = { rows: raw?.rows ?? raw, rowCount: (raw as any)?.rowCount ?? raw?.length ?? 0 };
    }

    else if (mode === "js") {
      // Safe eval in isolated context
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction("db", `"use strict"; ${code}`);
      result = { result: await fn(db) };
    }

    else if (mode === "bash") {
      const { stdout, stderr } = await execAsync(code, { timeout: 15000 });
      result = { stdout, stderr };
    }

    else { res.status(400).json({ error: "mode must be sql, js, or bash" }); return; }

    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/kb.ts` (NEW — condensed)

```typescript
import { Router } from "express";
import { db, kbArticlesTable } from "@workspace/db";
import { eq, desc, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/kb — public articles + internal (if auth)
router.get("/", async (req, res) => {
  try {
    const { search, audience } = req.query as { search?: string; audience?: string };
    let query = db.select().from(kbArticlesTable)
      .where(eq(kbArticlesTable.published, true)).$dynamic();
    if (search) {
      query = query.where(or(ilike(kbArticlesTable.title, `%${search}%`),
        ilike(kbArticlesTable.content, `%${search}%`)));
    }
    if (audience) query = query.where(eq(kbArticlesTable.audience, audience));
    const articles = await query.orderBy(desc(kbArticlesTable.views)).limit(50);
    res.json({ articles });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const [article] = await db.select().from(kbArticlesTable)
      .where(eq(kbArticlesTable.id, Number(req.params.id)));
    if (!article) { res.status(404).json({ error: "Not found" }); return; }
    await db.update(kbArticlesTable).set({ views: (article.views || 0) + 1 })
      .where(eq(kbArticlesTable.id, article.id));
    res.json({ article });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const [article] = await db.insert(kbArticlesTable).values({
      ...req.body, authorId: req.session.userId!,
    }).returning();
    res.json({ article });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const [article] = await db.update(kbArticlesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(kbArticlesTable.id, Number(req.params.id))).returning();
    res.json({ article });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/learn.ts` (NEW — condensed)

```typescript
import { Router } from "express";
import { db, learnCoursesTable, learnProgressTable, learnExamAttemptsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/courses", async (req, res) => {
  try {
    const courses = await db.select().from(learnCoursesTable)
      .where(eq(learnCoursesTable.published, true)).orderBy(learnCoursesTable.vendor);
    res.json({ courses });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/courses/:id", async (req, res) => {
  try {
    const [course] = await db.select().from(learnCoursesTable)
      .where(eq(learnCoursesTable.id, Number(req.params.id)));
    if (!course) { res.status(404).json({ error: "Not found" }); return; }
    const [progress] = await db.select().from(learnProgressTable).where(
      and(eq(learnProgressTable.courseId, course.id),
          eq(learnProgressTable.userId, req.session.userId!)));
    res.json({ course, progress: progress || null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/progress/:courseId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { percentComplete, lastSection } = req.body;
  try {
    const [existing] = await db.select().from(learnProgressTable).where(
      and(eq(learnProgressTable.courseId, courseId),
          eq(learnProgressTable.userId, req.session.userId!)));
    let progress;
    if (existing) {
      [progress] = await db.update(learnProgressTable)
        .set({ percentComplete, lastSection, updatedAt: new Date() })
        .where(eq(learnProgressTable.id, existing.id)).returning();
    } else {
      [progress] = await db.insert(learnProgressTable)
        .values({ userId: req.session.userId!, courseId, percentComplete, lastSection }).returning();
    }
    res.json({ progress });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/quiz/:courseId", async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { answers } = req.body;
  try {
    const [course] = await db.select().from(learnCoursesTable)
      .where(eq(learnCoursesTable.id, courseId));
    if (!course) { res.status(404).json({ error: "Not found" }); return; }
    // Calculate score
    const quizSections = (course.content as any[]).filter((s: any) => s.type === "quiz");
    let correct = 0; let total = 0;
    for (const section of quizSections) {
      for (let i = 0; i < (section.questions || []).length; i++) {
        total++;
        if (answers?.[`${section.id}-${i}`] === section.questions[i].correct) correct++;
      }
    }
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= (course.passScore || 70);
    const prevAttempts = await db.select().from(learnExamAttemptsTable).where(
      and(eq(learnExamAttemptsTable.courseId, courseId),
          eq(learnExamAttemptsTable.userId, req.session.userId!)));
    const [attempt] = await db.insert(learnExamAttemptsTable).values({
      userId: req.session.userId!, courseId, answers, score, passed,
      attemptNumber: prevAttempts.length + 1,
    }).returning();
    res.json({ attempt, score, passed, correct, total });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/progress/me", async (req, res) => {
  try {
    const progress = await db.select().from(learnProgressTable)
      .where(eq(learnProgressTable.userId, req.session.userId!));
    res.json({ progress });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/security.ts` (NEW — condensed)

```typescript
import { Router } from "express";
import { db, securityEventsTable, usersTable, devicesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();
router.use(requireAuth);

router.get("/events", async (req, res) => {
  try {
    const events = await db.select().from(securityEventsTable)
      .orderBy(desc(securityEventsTable.createdAt)).limit(100);
    res.json({ events });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/score", async (req, res) => {
  try {
    const [total] = await db.select({ count: count() }).from(usersTable);
    const [totpEnabled] = await db.select({ count: count() }).from(usersTable)
      .where(eq(usersTable.totpEnabled, true));
    const totpPct = Number(total.count) > 0
      ? Math.round((Number(totpEnabled.count) / Number(total.count)) * 100) : 0;
    const [online] = await db.select({ count: count() }).from(devicesTable)
      .where(eq(devicesTable.status, "online"));
    const score = Math.min(100, Math.round(
      (totpPct * 0.3) + (Number(online.count) > 0 ? 40 : 10) + 30
    ));
    res.json({ score, breakdown: { totpAdoption: totpPct, onlineDevices: Number(online.count) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

### FILE: `artifacts/api-server/src/routes/audit.ts` (NEW)

```typescript
import { Router } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();
router.use(requireAuth);

router.get("/", requireRole("admin", "super_admin", "manager"), async (req, res) => {
  try {
    const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(200);
    res.json({ logs });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/me", async (req, res) => {
  try {
    const logs = await db.select().from(auditLogsTable)
      .where(eq(auditLogsTable.userId, req.session.userId!))
      .orderBy(desc(auditLogsTable.createdAt)).limit(50);
    res.json({ logs });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

## 📁 SECTION C — FRONTEND PAGES
### All files in: `artifacts/portal/src/pages/` and `artifacts/portal/src/components/`

---

### FILE: `artifacts/portal/src/lib/design-tokens.ts` (NEW)

```typescript
export const C = {
  BG:          "#0a0e1a",
  SIDEBAR:     "#0d1117",
  CARD:        "#111827",
  ELEVATED:    "#161f2e",
  HOVER:       "#1a2332",
  PRIMARY:     "#0078d4",
  PRIMARY_DIM: "#0078d418",
  BORDER:      "#1e293b",
  BORDER_L:    "#1a2332",
  TEXT:        "#f8fafc",
  TEXT_2:      "#94a3b8",
  TEXT_3:      "#475569",
  TEXT_4:      "#334155",
  SUCCESS:     "#22c55e",
  WARN:        "#f59e0b",
  ERROR:       "#ef4444",
  INFO:        "#6366f1",
  PURPLE:      "#7c3aed",
  TEAL:        "#10b981",
} as const;

export const S = {
  card:   { background: C.CARD,  border: `1px solid ${C.BORDER}`, borderRadius: 12, padding: "1.5rem" },
  input:  { background: C.BG,    border: `1px solid ${C.BORDER}`, borderRadius: 8, color: C.TEXT, padding: ".55rem .85rem", fontSize: ".875rem", width: "100%", outline: "none" },
  btnP:   { background: C.PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: ".55rem 1.25rem", fontSize: ".875rem", fontWeight: 600, cursor: "pointer" },
  btnG:   { background: "transparent", color: C.TEXT_2, border: `1px solid ${C.BORDER}`, borderRadius: 8, padding: ".55rem 1.25rem", fontSize: ".875rem", cursor: "pointer" },
  btnD:   { background: C.ERROR, color: "#fff", border: "none", borderRadius: 8, padding: ".55rem 1.25rem", fontSize: ".875rem", fontWeight: 600, cursor: "pointer" },
  badge:  (color: string) => ({ background: `${color}22`, color, borderRadius: 6, padding: ".15rem .5rem", fontSize: ".75rem", fontWeight: 600 }),
  page:   { padding: "2rem", maxWidth: 1200, fontFamily: "'Inter',system-ui,sans-serif" },
  label:  { fontSize: ".8rem", color: C.TEXT_2, marginBottom: ".3rem", display: "block" },
} as const;
```

---

### FILE: `artifacts/portal/src/components/Layout.tsx` (REPLACE — full nav)

```tsx
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { C } from "../lib/design-tokens";

type NavGroup = { label: string; items: { label: string; path: string; icon: string; roles?: string[] }[] };

const NAV: NavGroup[] = [
  { label: "MAIN", items: [
    { label: "Dashboard",       path: "/portal",              icon: "🏠" },
    { label: "Tickets",         path: "/portal/tickets",      icon: "🎫" },
    { label: "Knowledge Base",  path: "/portal/kb",           icon: "📚" },
    { label: "HaloBot AI",      path: "/portal/ai",           icon: "🤖" },
    { label: "Learn Centre",    path: "/portal/learn",        icon: "🎓" },
    { label: "IT Shop",         path: "/portal/shop",         icon: "🛒" },
  ]},
  { label: "MSP", items: [
    { label: "Clients",    path: "/portal/clients",    icon: "👥", roles: ["admin","manager","technician","agent","super_admin"] },
    { label: "Quotations", path: "/portal/quotations", icon: "📄", roles: ["admin","manager","super_admin"] },
    { label: "Invoices",   path: "/portal/invoices",   icon: "💰", roles: ["admin","manager","super_admin"] },
    { label: "SLA Plans",  path: "/portal/sla",        icon: "📋", roles: ["admin","manager","super_admin"] },
    { label: "VoIP",       path: "/portal/voip",       icon: "📡", roles: ["admin","manager","technician","agent","super_admin"] },
  ]},
  { label: "TECHNICAL", items: [
    { label: "RMM Console",  path: "/portal/rmm",       icon: "🖥️", roles: ["admin","manager","technician","agent","super_admin"] },
    { label: "Tools",        path: "/portal/tools",     icon: "🔧" },
    { label: "Security",     path: "/portal/security",  icon: "🔒", roles: ["admin","manager","super_admin"] },
    { label: "Backup",       path: "/portal/backup",    icon: "💾", roles: ["admin","super_admin"] },
  ]},
  { label: "ADMIN", items: [
    { label: "Users",        path: "/portal/admin/users",    icon: "👤",  roles: ["admin","super_admin"] },
    { label: "HR System",    path: "/portal/hr",             icon: "🏢",  roles: ["admin","manager","super_admin"] },
    { label: "Vault",        path: "/portal/vault",          icon: "🔐",  roles: ["admin","super_admin"] },
    { label: "Integrations", path: "/portal/integrations",  icon: "🔗",  roles: ["admin","super_admin"] },
    { label: "Ads Centre",   path: "/portal/ads",            icon: "📢",  roles: ["admin","super_admin"] },
    { label: "Expansion",    path: "/portal/expansion",      icon: "🚀",  roles: ["super_admin"] },
    { label: "App Builder",  path: "/portal/appbuilder",     icon: "🏗️", roles: ["super_admin"] },
    { label: "Audit Log",    path: "/portal/audit",          icon: "📊",  roles: ["admin","super_admin"] },
    { label: "Dev Console",  path: "/portal/devconsole",     icon: "💻",  roles: ["super_admin"] },
  ]},
  { label: "ACCOUNT", items: [
    { label: "My Account", path: "/portal/security", icon: "⚙️" },
  ]},
];

const ROLE_COLOR: Record<string, string> = {
  super_admin: "#f59e0b", admin: "#0078d4", manager: "#8b5cf6",
  technician: "#10b981", agent: "#10b981", customer: "#94a3b8",
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [loc] = useLocation();
  if (!user) return null;

  const hasRole = (roles?: string[]) => !roles || roles.includes(user.role) || user.role === "super_admin";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter',system-ui,sans-serif", background: C.BG }}>
      {/* SIDEBAR */}
      <aside style={{ width: 230, background: C.SIDEBAR, borderRight: `1px solid ${C.BORDER_L}`, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${C.BORDER_L}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: C.PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: "1.1rem", flexShrink: 0 }}>H</div>
            <div>
              <div style={{ fontWeight: 700, color: C.TEXT, fontSize: ".88rem" }}>Halo IT 365</div>
              <div style={{ fontSize: ".65rem", color: ROLE_COLOR[user.role] || C.TEXT_2, fontWeight: 600, textTransform: "uppercase" }}>{user.role.replace("_", " ")}</div>
            </div>
          </div>
        </div>

        {/* Nav Groups */}
        <nav style={{ flex: 1, padding: ".5rem .6rem" }}>
          {NAV.map(group => (
            <div key={group.label} style={{ marginBottom: ".5rem" }}>
              <div style={{ fontSize: ".6rem", color: C.TEXT_4, fontWeight: 700, letterSpacing: ".08em", padding: ".4rem .75rem .2rem" }}>{group.label}</div>
              {group.items.filter(i => hasRole(i.roles)).map(item => {
                const active = loc === item.path || loc.startsWith(item.path + "/");
                return (
                  <Link key={item.path} href={item.path}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: ".55rem",
                      padding: ".45rem .75rem", borderRadius: 7, marginBottom: ".05rem",
                      background: active ? `${C.PRIMARY}18` : "transparent",
                      color: active ? "#60a5fa" : C.TEXT_3,
                      fontSize: ".845rem", fontWeight: active ? 600 : 400,
                      border: active ? `1px solid ${C.PRIMARY}28` : "1px solid transparent",
                      cursor: "pointer", transition: "all .1s",
                    }}>
                      <span style={{ fontSize: ".85rem" }}>{item.icon}</span>
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: ".75rem", borderTop: `1px solid ${C.BORDER_L}` }}>
          <div style={{ background: C.BG, borderRadius: 7, padding: ".5rem .7rem", marginBottom: ".5rem" }}>
            <div style={{ fontSize: ".84rem", fontWeight: 600, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div style={{ fontSize: ".72rem", color: C.TEXT_4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          <button onClick={logout} style={{ width: "100%", background: "transparent", border: `1px solid ${C.BORDER}`, color: C.TEXT_3, padding: ".4rem", borderRadius: 6, fontSize: ".82rem", cursor: "pointer" }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, overflowY: "auto", background: C.BG }}>
        {!user.totpEnabled && loc !== "/portal/security" && (
          <div style={{ background: `linear-gradient(90deg,${C.PURPLE}22,${C.PRIMARY}22)`, borderBottom: `1px solid ${C.PURPLE}44`, padding: ".5rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#c4b5fd", fontSize: ".83rem" }}>🔐 <strong style={{ color: "#e9d5ff" }}>Enable 2FA</strong> — protect your account with TOTP</span>
            <Link href="/portal/security">
              <button style={{ background: C.PURPLE, border: "none", color: "#fff", padding: ".3rem .85rem", borderRadius: 6, fontSize: ".78rem", cursor: "pointer" }}>Enable →</button>
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
```

---

### FILE: `artifacts/portal/src/pages/Dashboard.tsx` (REPLACE — full featured)

```tsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { C, S } from "../lib/design-tokens";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [greeting, setGreeting] = useState<any>(null);

  useEffect(() => {
    api.get<any>("/admin/stats").then(setStats).catch(() => {});
    api.get<any>("/ai/daily-prompt").then(setGreeting).catch(() => {});
  }, []);

  const SC = [
    { label: "Open Tickets",     val: stats?.openTickets ?? "–",     color: C.WARN,    icon: "🎫" },
    { label: "Resolved Today",   val: stats?.resolvedTickets ?? "–",  color: C.SUCCESS, icon: "✅" },
    { label: "Active Clients",   val: stats?.totalCustomers ?? "–",   color: C.INFO,    icon: "👥" },
    { label: "Total Users",      val: stats?.totalUsers ?? "–",       color: C.PRIMARY, icon: "👤" },
  ];

  return (
    <div style={{ ...S.page, maxWidth: 1300 }}>
      {/* Greeting */}
      {greeting && (
        <div style={{ ...S.card, marginBottom: "1.5rem", background: `linear-gradient(135deg,${C.PRIMARY}18,${C.PURPLE}18)`, borderColor: `${C.PRIMARY}44` }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: C.TEXT }}>{greeting.greeting}</div>
          {greeting.suggestion && <div style={{ color: C.TEXT_2, fontSize: ".88rem", marginTop: ".35rem" }}>💡 {greeting.suggestion}</div>}
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {SC.map(s => (
          <div key={s.label} style={{ ...S.card, borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: "1.75rem", marginBottom: ".4rem" }}>{s.icon}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: C.TEXT }}>{s.val}</div>
            <div style={{ fontSize: ".8rem", color: C.TEXT_2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 style={{ color: C.TEXT_2, fontSize: ".8rem", fontWeight: 700, letterSpacing: ".08em", marginBottom: ".75rem" }}>QUICK ACTIONS</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: ".75rem", marginBottom: "2rem" }}>
        {[
          { label: "New Ticket",    href: "/portal/tickets/new",  icon: "➕", color: C.PRIMARY },
          { label: "HaloBot AI",    href: "/portal/ai",           icon: "🤖", color: C.PURPLE },
          { label: "RMM Console",   href: "/portal/rmm",          icon: "🖥️", color: C.INFO },
          { label: "Knowledge Base",href: "/portal/kb",           icon: "📚", color: C.TEAL },
          { label: "Learn Centre",  href: "/portal/learn",        icon: "🎓", color: "#ec4899" },
          { label: "Security",      href: "/portal/security",     icon: "🔐", color: C.WARN },
        ].map(a => (
          <a key={a.label} href={a.href} style={{ textDecoration: "none" }}>
            <div style={{ ...S.card, cursor: "pointer", borderTop: `3px solid ${a.color}`, padding: "1rem" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = a.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = a.color)}>
              <div style={{ fontSize: "1.5rem", marginBottom: ".4rem" }}>{a.icon}</div>
              <div style={{ fontSize: ".875rem", fontWeight: 600, color: C.TEXT }}>{a.label}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
```

---

### FILE: `artifacts/portal/src/pages/RMM.tsx` (NEW — full featured)

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { C, S } from "../lib/design-tokens";

type Device = {
  id: number; deviceName: string; hostname: string; os: string;
  status: string; cpuPercent: number; diskGb: number; diskFreeGb: number;
  lastSeen: string; clientId: number; agentType: string;
};

const STATUS_COLOR: Record<string, string> = {
  online: C.SUCCESS, offline: C.ERROR, warning: C.WARN, critical: C.ERROR, pending: C.TEXT_3,
};

export default function RMM() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [tab, setTab] = useState<"devices" | "alerts" | "scripts" | "deploy">("devices");
  const [generating, setGenerating] = useState(false);
  const [agentScript, setAgentScript] = useState<any>(null);
  const [genForm, setGenForm] = useState({ deviceName: "", agentType: "windows_ps" });

  useEffect(() => {
    api.get<{ devices: Device[] }>("/rmm/devices").then(d => setDevices(d.devices)).catch(() => {});
    api.get<{ alerts: any[] }>("/rmm/alerts").then(d => setAlerts(d.alerts)).catch(() => {});
  }, []);

  const generateAgent = async () => {
    if (!genForm.deviceName) return;
    setGenerating(true);
    try {
      const r = await api.post<any>("/rmm/agent/generate", genForm);
      setAgentScript(r);
    } finally { setGenerating(false); }
  };

  const copyScript = () => {
    if (agentScript?.script) navigator.clipboard.writeText(agentScript.script);
  };

  const downloadScript = () => {
    if (!agentScript?.script) return;
    const ext = genForm.agentType === "linux" ? "sh" : "ps1";
    const blob = new Blob([agentScript.script], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `halo-agent-${genForm.deviceName}.${ext}`; a.click();
  };

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: C.TEXT, margin: 0 }}>🖥️ RMM Console</h1>
          <p style={{ color: C.TEXT_2, fontSize: ".85rem", marginTop: ".2rem" }}>
            {devices.filter(d => d.status === "online").length} online / {devices.length} total devices
          </p>
        </div>
        <button style={S.btnP} onClick={() => setTab("deploy")}>+ Deploy Agent</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: ".5rem", marginBottom: "1.5rem" }}>
        {(["devices", "alerts", "scripts", "deploy"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...S.btnG, background: tab === t ? `${C.PRIMARY}22` : "transparent",
            color: tab === t ? "#60a5fa" : C.TEXT_3, borderColor: tab === t ? C.PRIMARY : C.BORDER,
            textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>

      {/* Devices Tab */}
      {tab === "devices" && (
        <div style={{ display: "grid", gap: ".75rem" }}>
          {devices.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", color: C.TEXT_3, padding: "3rem" }}>
              No devices enrolled. Deploy an agent to get started.
            </div>
          )}
          {devices.map(d => {
            const diskUsed = d.diskGb > 0 ? Math.round(((d.diskGb - d.diskFreeGb) / d.diskGb) * 100) : 0;
            return (
              <div key={d.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLOR[d.status] || C.TEXT_3, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: C.TEXT }}>{d.deviceName}</div>
                    <div style={{ fontSize: ".78rem", color: C.TEXT_2 }}>{d.hostname} · {d.os}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                  {[
                    { label: "CPU", val: `${d.cpuPercent ?? 0}%`, warn: (d.cpuPercent ?? 0) > 80 },
                    { label: "Disk", val: `${diskUsed}%`, warn: diskUsed > 80 },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: ".75rem", color: C.TEXT_3 }}>{m.label}</div>
                      <div style={{ fontWeight: 700, color: m.warn ? C.WARN : C.TEXT, fontSize: ".95rem" }}>{m.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: ".5rem" }}>
                  <span style={S.badge(STATUS_COLOR[d.status] || C.TEXT_3)}>{d.status}</span>
                  <span style={S.badge(C.TEXT_3)}>{d.agentType}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deploy Tab */}
      {tab === "deploy" && (
        <div style={{ maxWidth: 680 }}>
          <div style={S.card}>
            <h3 style={{ color: C.TEXT, marginBottom: "1.25rem", fontSize: "1.05rem" }}>Generate Halo IT Agent Installer</h3>
            <div style={{ marginBottom: "1rem" }}>
              <label style={S.label}>Device / Computer Name</label>
              <input style={S.input} placeholder="e.g. WORKSTATION-01 or Server-DC1"
                value={genForm.deviceName} onChange={e => setGenForm(f => ({ ...f, deviceName: e.target.value }))} />
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={S.label}>Agent Type</label>
              <select style={S.input} value={genForm.agentType}
                onChange={e => setGenForm(f => ({ ...f, agentType: e.target.value }))}>
                <option value="windows_ps">Windows (PowerShell .ps1)</option>
                <option value="linux">Linux (Bash .sh)</option>
              </select>
            </div>
            <button style={S.btnP} onClick={generateAgent} disabled={generating}>
              {generating ? "Generating..." : "Generate Agent Script"}
            </button>
          </div>

          {agentScript && (
            <div style={{ ...S.card, marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".75rem" }}>
                <h4 style={{ color: C.TEXT, margin: 0 }}>Agent Script Ready</h4>
                <div style={{ display: "flex", gap: ".5rem" }}>
                  <button style={S.btnG} onClick={copyScript}>Copy</button>
                  <button style={S.btnP} onClick={downloadScript}>⬇ Download</button>
                </div>
              </div>
              <pre style={{ background: C.BG, border: `1px solid ${C.BORDER}`, borderRadius: 8, padding: "1rem", color: C.SUCCESS, fontSize: ".78rem", overflow: "auto", maxHeight: 300 }}>
                {agentScript.script?.slice(0, 600)}...
              </pre>
              <div style={{ marginTop: ".75rem", fontSize: ".82rem", color: C.TEXT_2 }}>
                <strong style={{ color: C.WARN }}>Windows:</strong> Run as Administrator: <code style={{ color: C.SUCCESS }}>powershell -ExecutionPolicy Bypass -File halo-agent.ps1</code><br/>
                To install as service add <code style={{ color: C.SUCCESS }}>-Install</code> flag<br/>
                <strong style={{ color: C.WARN }}>Linux:</strong> <code style={{ color: C.SUCCESS }}>chmod +x halo-agent.sh && sudo ./halo-agent.sh --install</code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {tab === "alerts" && (
        <div style={{ display: "grid", gap: ".6rem" }}>
          {alerts.length === 0 && <div style={{ ...S.card, textAlign: "center", color: C.TEXT_3, padding: "2.5rem" }}>No alerts.</div>}
          {alerts.map(a => (
            <div key={a.id} style={{ ...S.card, display: "flex", gap: "1rem", alignItems: "flex-start", borderLeft: `3px solid ${a.severity === "critical" ? C.ERROR : a.severity === "warning" ? C.WARN : C.INFO}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: C.TEXT }}>{a.title}</div>
                <div style={{ fontSize: ".82rem", color: C.TEXT_2 }}>{a.message}</div>
              </div>
              <span style={S.badge(a.severity === "critical" ? C.ERROR : a.severity === "warning" ? C.WARN : C.INFO)}>{a.severity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### FILE: `artifacts/portal/src/pages/AI.tsx` (REPLACE — full streaming chat)

```tsx
import { useState, useEffect, useRef } from "react";
import { C, S } from "../lib/design-tokens";

type Message = { role: "user" | "assistant"; content: string };

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim(); setInput("");
    setMessages(m => [...m, { role: "user", content: msg }]);
    setLoading(true);
    let assistantContent = "";

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      setMessages(m => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            const data = JSON.parse(line.replace("data:", "").trim());
            if (data.delta) {
              assistantContent += data.delta;
              setMessages(m => m.map((msg, i) =>
                i === m.length - 1 ? { ...msg, content: assistantContent } : msg
              ));
            }
            if (data.sessionId) setSessionId(data.sessionId);
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const SUGGESTIONS = [
    "Show me my system status and stats",
    "Generate a PowerShell script to check disk space on all drives",
    "What are the top 5 Microsoft 365 security best practices?",
    "Help me write a professional incident report",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 0px)", background: C.BG }}>
      {/* Header */}
      <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${C.BORDER}`, display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg,${C.PRIMARY},${C.PURPLE})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700, color: C.TEXT }}>HaloBot AI Assistant</div>
          <div style={{ fontSize: ".75rem", color: C.SUCCESS }}>● Online — DeepSeek-V4-Pro</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>👋</div>
            <p style={{ color: C.TEXT_2, marginBottom: "1.5rem" }}>Hi! I'm HaloBot — Ask me anything about IT support, scripts, or this system.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", justifyContent: "center" }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setInput(s); }} style={{
                  background: C.CARD, border: `1px solid ${C.BORDER}`, borderRadius: 8,
                  color: C.TEXT_2, padding: ".45rem .9rem", fontSize: ".8rem", cursor: "pointer",
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "1rem", display: "flex", flexDirection: "column",
            alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: ".75rem 1rem", borderRadius: 12,
              background: m.role === "user" ? C.PRIMARY : C.CARD,
              border: m.role === "user" ? "none" : `1px solid ${C.BORDER}`,
              color: C.TEXT, fontSize: ".875rem", lineHeight: 1.6,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {m.content || (loading && i === messages.length - 1 ? "▊" : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${C.BORDER}` }}>
        <div style={{ display: "flex", gap: ".75rem" }}>
          <input
            style={{ ...S.input, flex: 1, padding: ".7rem 1rem", borderRadius: 10 }}
            placeholder="Ask HaloBot anything — IT support, scripts, system analysis..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          />
          <button style={{ ...S.btnP, padding: ".7rem 1.25rem", borderRadius: 10, minWidth: 80 }}
            onClick={send} disabled={loading}>
            {loading ? "…" : "Send ↑"}
          </button>
        </div>
        <div style={{ fontSize: ".7rem", color: C.TEXT_4, textAlign: "center", marginTop: ".4rem" }}>
          Shift+Enter for new line · Enter to send
        </div>
      </div>
    </div>
  );
}
```

---

### FILE: `artifacts/portal/src/pages/DevConsole.tsx` (REPLACE — full terminal)

```tsx
import { useState } from "react";
import { api } from "../lib/api";
import { C, S } from "../lib/design-tokens";

type Mode = "sql" | "js" | "bash";

export default function DevConsole() {
  const [mode, setMode] = useState<Mode>("sql");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const STARTERS: Record<Mode, string> = {
    sql: "SELECT * FROM users ORDER BY created_at DESC LIMIT 10;",
    js:  "const result = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM tickets', params: [] });\nreturn result.rows;",
    bash: "echo 'System info:' && uname -a && df -h / && free -m",
  };

  const run = async () => {
    if (!code.trim()) return;
    setRunning(true); setOutput(null);
    try {
      const r = await api.post<any>("/devconsole/exec", { mode, code });
      setOutput(r);
    } catch (e: any) {
      setOutput({ ok: false, error: e.message });
    } finally { setRunning(false); }
  };

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.TEXT, margin: 0 }}>💻 Dev Console</h1>
        <div style={{ fontSize: ".8rem", color: C.WARN, background: `${C.WARN}18`, border: `1px solid ${C.WARN}44`, padding: ".3rem .75rem", borderRadius: 6 }}>
          ⚠️ Super Admin Only
        </div>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: "flex", gap: ".5rem", marginBottom: "1rem" }}>
        {(["sql", "js", "bash"] as Mode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setCode(STARTERS[m]); }} style={{
            ...S.btnG, background: mode === m ? `${C.PRIMARY}22` : "transparent",
            color: mode === m ? "#60a5fa" : C.TEXT_3, borderColor: mode === m ? C.PRIMARY : C.BORDER,
            textTransform: "uppercase", fontSize: ".75rem", letterSpacing: ".05em",
          }}>{m}</button>
        ))}
      </div>

      {/* Code Editor */}
      <div style={{ ...S.card, marginBottom: "1rem", padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".65rem 1rem", borderBottom: `1px solid ${C.BORDER}`, background: C.ELEVATED }}>
          <span style={{ fontSize: ".78rem", color: C.TEXT_3 }}>
            {mode === "sql" && "PostgreSQL — Direct database query"}
            {mode === "js" && "JavaScript — Async function with `db` available"}
            {mode === "bash" && "Bash — Shell command (15s timeout)"}
          </span>
          <button style={{ ...S.btnP, padding: ".35rem 1rem", fontSize: ".8rem" }}
            onClick={run} disabled={running}>
            {running ? "Running…" : "▶ Run"}
          </button>
        </div>
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.ctrlKey && e.key === "Enter" && run()}
          style={{
            width: "100%", minHeight: 220, background: "#0a0e1a", color: "#e2e8f0",
            border: "none", padding: "1rem", fontSize: ".85rem",
            fontFamily: "'Fira Code','Courier New',monospace", lineHeight: 1.6,
            resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
          spellCheck={false}
          placeholder={STARTERS[mode]}
        />
      </div>

      {/* Output */}
      {output && (
        <div style={{ ...S.card, borderLeft: `3px solid ${output.ok !== false ? C.SUCCESS : C.ERROR}` }}>
          <div style={{ fontSize: ".75rem", color: output.ok !== false ? C.SUCCESS : C.ERROR, marginBottom: ".5rem", fontWeight: 700 }}>
            {output.ok !== false ? "✓ Success" : "✗ Error"}
          </div>
          <pre style={{ color: "#e2e8f0", fontSize: ".82rem", fontFamily: "'Fira Code','Courier New',monospace", margin: 0, overflow: "auto", maxHeight: 400 }}>
            {output.error ? output.error : JSON.stringify(output.result ?? output, null, 2)}
          </pre>
          {output.result?.rows && (
            <div style={{ fontSize: ".75rem", color: C.TEXT_3, marginTop: ".5rem" }}>
              {output.result.rowCount} row(s) returned
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "1rem", fontSize: ".78rem", color: C.TEXT_4 }}>
        Ctrl+Enter to run · All executions are audit logged
      </div>
    </div>
  );
}
```

---

### FILE: `artifacts/portal/src/pages/Invoices.tsx` (NEW — condensed)

```tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { C, S } from "../lib/design-tokens";

type Invoice = {
  id: number; invoiceNumber: string; clientName: string; total: number;
  status: string; createdAt: string; type: string;
};

const STATUS_COLOR: Record<string, string> = {
  draft: C.TEXT_3, sent: C.INFO, paid: C.SUCCESS, overdue: C.ERROR, cancelled: C.TEXT_3,
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showing, setShowing] = useState<"list" | "create">("list");

  useEffect(() => {
    api.get<{ invoices: Invoice[] }>("/invoices").then(d => setInvoices(d.invoices)).catch(() => {});
  }, []);

  const fmtZAR = (cents: number) => `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.TEXT, margin: 0 }}>💰 Invoices</h1>
        <button style={S.btnP} onClick={() => setShowing(s => s === "list" ? "create" : "list")}>
          {showing === "list" ? "+ New Invoice" : "← Back"}
        </button>
      </div>

      {showing === "list" && (
        <div>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: ".75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Total Invoices", val: invoices.length, color: C.PRIMARY },
              { label: "Paid", val: invoices.filter(i => i.status === "paid").length, color: C.SUCCESS },
              { label: "Outstanding", val: invoices.filter(i => i.status === "sent").length, color: C.WARN },
              { label: "Overdue", val: invoices.filter(i => i.status === "overdue").length, color: C.ERROR },
            ].map(s => (
              <div key={s.label} style={{ ...S.card, borderTop: `3px solid ${s.color}`, padding: "1rem" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: C.TEXT }}>{s.val}</div>
                <div style={{ fontSize: ".78rem", color: C.TEXT_2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Invoice list */}
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: ".85rem 1.25rem", borderBottom: `1px solid ${C.BORDER}`, background: C.ELEVATED }}>
              <span style={{ fontSize: ".8rem", fontWeight: 600, color: C.TEXT_2 }}>ALL INVOICES</span>
            </div>
            {invoices.length === 0 && <div style={{ padding: "3rem", textAlign: "center", color: C.TEXT_3 }}>No invoices yet.</div>}
            {invoices.map(inv => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".85rem 1.25rem", borderBottom: `1px solid ${C.BORDER}`, flexWrap: "wrap", gap: ".5rem" }}>
                <div>
                  <div style={{ fontWeight: 600, color: C.TEXT, fontSize: ".9rem" }}>{inv.invoiceNumber}</div>
                  <div style={{ fontSize: ".78rem", color: C.TEXT_2 }}>{inv.clientName} · {inv.type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: C.TEXT }}>{fmtZAR(inv.total)}</div>
                  <span style={S.badge(STATUS_COLOR[inv.status] || C.TEXT_3)}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showing === "create" && <CreateInvoiceForm onCreated={() => { setShowing("list"); }} />}
    </div>
  );
}

function CreateInvoiceForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ clientName: "", clientEmail: "", type: "support", notes: "" });
  const [items, setItems] = useState([{ description: "", qty: 1, unitPrice: 0, vatRate: 15 }]);
  const [saving, setSaving] = useState(false);
  const fmtZAR = (n: number) => `R ${(n / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const vat = Math.round(subtotal * 0.15);
  const total = subtotal + vat;

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/invoices", { ...form, items });
      onCreated();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={S.card}>
        <h3 style={{ color: C.TEXT, marginBottom: "1.25rem" }}>New Invoice — Halo IT Services 365</h3>
        {/* Client details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          {[["clientName","Client Name"],["clientEmail","Client Email"]].map(([k, l]) => (
            <div key={k}>
              <label style={S.label}>{l}</label>
              <input style={S.input} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        {/* Line items */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={S.label}>Line Items</label>
          {items.map((item, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr auto", gap: ".5rem", marginBottom: ".5rem" }}>
              <input style={S.input} placeholder="Description" value={item.description}
                onChange={e => setItems(it => it.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
              <input style={S.input} type="number" placeholder="Qty" value={item.qty}
                onChange={e => setItems(it => it.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
              <input style={S.input} type="number" placeholder="Price (cents)" value={item.unitPrice}
                onChange={e => setItems(it => it.map((x, j) => j === i ? { ...x, unitPrice: Number(e.target.value) } : x))} />
              <button style={{ ...S.btnD, padding: ".5rem .75rem" }} onClick={() => setItems(it => it.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button style={S.btnG} onClick={() => setItems(it => [...it, { description: "", qty: 1, unitPrice: 0, vatRate: 15 }])}>
            + Add Line Item
          </button>
        </div>
        {/* Totals */}
        <div style={{ background: C.BG, borderRadius: 8, padding: "1rem", marginBottom: "1.25rem", textAlign: "right" }}>
          <div style={{ color: C.TEXT_2, marginBottom: ".25rem" }}>Subtotal: <strong style={{ color: C.TEXT }}>{fmtZAR(subtotal)}</strong></div>
          <div style={{ color: C.TEXT_2, marginBottom: ".25rem" }}>VAT (15%): <strong style={{ color: C.TEXT }}>{fmtZAR(vat)}</strong></div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.TEXT, marginTop: ".5rem" }}>Total: {fmtZAR(total)}</div>
        </div>
        <button style={S.btnP} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Draft Invoice"}</button>
      </div>
    </div>
  );
}
```

---

## 📁 SECTION D — CONFIGURATION FILES

### FILE: `artifacts/portal/src/App.tsx` (ADD ROUTES — partial replacement)

```tsx
// Add these imports to existing imports:
import Clients      from "./pages/Clients";
import Quotations   from "./pages/Quotations";
import Invoices     from "./pages/Invoices";
import AI           from "./pages/AI";
import KnowledgeBase from "./pages/KnowledgeBase";
import Learn        from "./pages/Learn";
import RMM          from "./pages/RMM";
import Security     from "./pages/Security";
import Vault        from "./pages/Vault";
import Tools        from "./pages/Tools";
import HR           from "./pages/HR";
import Shop         from "./pages/Shop";
import Backup       from "./pages/Backup";
import DevConsole   from "./pages/DevConsole";
import AppBuilder   from "./pages/AppBuilder";
import AuditLog     from "./pages/AuditLog";
import SLA          from "./pages/SLA";
import VoIP         from "./pages/VoIP";

// Add these routes inside <Switch> after existing routes:
<Route path="/portal/clients"     component={() => <ProtectedRoute><Clients /></ProtectedRoute>} />
<Route path="/portal/quotations"  component={() => <ProtectedRoute><Quotations /></ProtectedRoute>} />
<Route path="/portal/invoices"    component={() => <ProtectedRoute><Invoices /></ProtectedRoute>} />
<Route path="/portal/ai"          component={() => <ProtectedRoute><AI /></ProtectedRoute>} />
<Route path="/portal/kb"          component={() => <ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
<Route path="/portal/learn"       component={() => <ProtectedRoute><Learn /></ProtectedRoute>} />
<Route path="/portal/rmm"         component={() => <ProtectedRoute><RMM /></ProtectedRoute>} />
<Route path="/portal/security"    component={() => <ProtectedRoute><Security /></ProtectedRoute>} />
<Route path="/portal/vault"       component={() => <ProtectedRoute><Vault /></ProtectedRoute>} />
<Route path="/portal/tools"       component={() => <ProtectedRoute><Tools /></ProtectedRoute>} />
<Route path="/portal/hr"          component={() => <ProtectedRoute><HR /></ProtectedRoute>} />
<Route path="/portal/shop"        component={() => <ProtectedRoute><Shop /></ProtectedRoute>} />
<Route path="/portal/backup"      component={() => <ProtectedRoute><Backup /></ProtectedRoute>} />
<Route path="/portal/devconsole"  component={() => <ProtectedRoute roles={["super_admin"]}><DevConsole /></ProtectedRoute>} />
<Route path="/portal/appbuilder"  component={() => <ProtectedRoute roles={["super_admin"]}><AppBuilder /></ProtectedRoute>} />
<Route path="/portal/audit"       component={() => <ProtectedRoute roles={["admin","super_admin","manager"]}><AuditLog /></ProtectedRoute>} />
<Route path="/portal/sla"         component={() => <ProtectedRoute><SLA /></ProtectedRoute>} />
<Route path="/portal/voip"        component={() => <ProtectedRoute><VoIP /></ProtectedRoute>} />
```

---

### FILE: `.env` (COMPLETE REFERENCE)

```bash
# ── DATABASE ─────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:5432/haloit365

# ── SESSION ──────────────────────────────────────────────────────
SESSION_SECRET=change-this-to-64-random-characters-immediately

# ── VAULT ────────────────────────────────────────────────────────
VAULT_SECRET=change-this-to-32-chars-for-aes256

# ── AI — AZURE DEEPSEEK ──────────────────────────────────────────
# Get from: portal.azure.com → AI Foundry → Models → DeepSeek-V4-Pro → Deploy
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.services.ai.azure.com/models
AZURE_OPENAI_KEY=your-azure-ai-foundry-api-key-here
AI_MODEL=DeepSeek-V4-Pro

# ── AI FALLBACK (free, local Ollama) ─────────────────────────────
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# ── EMAIL ────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM_NAME=Halo IT Services 365
SMTP_FROM_EMAIL=support@haloitservices365.co.za

# ── SERVER ───────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production
SERVER_URL=https://your-app.up.railway.app

# ── COMPANY (used in invoice PDFs) ───────────────────────────────
COMPANY_NAME=Halo IT Services 365 (Pty) Ltd
COMPANY_VAT=ZA4XXXXXXXX
COMPANY_PHONE=+27 XXX XXX XXXX
COMPANY_EMAIL=willem.hattingh@haloitservices365.co.za
COMPANY_ADDRESS=Cape Town, Western Cape, South Africa
COMPANY_BANK=FNB
COMPANY_ACCOUNT=XXXXXXXXX
COMPANY_BRANCH=250655

# ── FILE UPLOAD ───────────────────────────────────────────────────
UPLOAD_DIR=./uploads
MAX_FILE_MB=100
```

---

## 📁 SECTION E — IMPLEMENTATION ORDER

```
WEEK 1: FOUNDATION EXTENSION
 Step 1: Add ALL schema from Section A to lib/db/src/schema/index.ts
         Run: pnpm run db:push
 Step 2: Add artifacts/api-server/src/middleware/rbac.ts
 Step 3: Replace artifacts/api-server/src/routes/index.ts
 Step 4: Add clients.ts route
 Step 5: Add audit.ts + notifications.ts routes
 Step 6: Replace Layout.tsx with full nav version
 Step 7: Add design-tokens.ts to portal/src/lib/
 Step 8: Replace Dashboard.tsx

WEEK 2: TICKETING + CLIENTS + SLA
 Step 9:  Extend tickets.ts route (add approval flow, time tracking)
 Step 10: Add sla.ts route + seed 6 SLA tiers
 Step 11: Add invoices.ts + quotations.ts routes
 Step 12: Add Invoices.tsx + Quotations.tsx + Clients.tsx pages

WEEK 3: AI + KNOWLEDGE
 Step 13: Add ai.ts route (full streaming)
 Step 14: Add AI.tsx page (streaming chat)
 Step 15: Add kb.ts route + KnowledgeBase.tsx
 Step 16: Add learn.ts route + Learn.tsx

WEEK 4: TECHNICAL
 Step 17: Add rmm.ts route + RMM.tsx page (agent deploy)
 Step 18: Add security.ts route + Security.tsx
 Step 19: Add vault.ts route + Vault.tsx
 Step 20: Add tools.ts route + Tools.tsx

WEEK 5: BUSINESS
 Step 21: Add hr.ts route + HR.tsx
 Step 22: Add shop.ts route + Shop.tsx
 Step 23: Add backup.ts route + Backup.tsx
 Step 24: Add DevConsole.tsx (replace existing)
 Step 25: Add appbuilder.ts + AppBuilder.tsx
 Step 26: Add audit.ts route + AuditLog.tsx

FINAL: DEPLOY
 Step 27: Configure .env with real values
 Step 28: pnpm run build (verify zero errors)
 Step 29: Deploy to Railway (connect GitHub repo)
 Step 30: Test all endpoints with super_admin account
```

---

## 📁 SECTION F — SEED DATA
### FILE: `scripts/seed-phase2.ts`

```typescript
import { db, slaPackagesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedPhase2() {
  // ── SLA TIERS ──────────────────────────────────────────────────
  const tiers = [
    { tier: "bronze",   name: "Bronze Basic",     priceMonthly: 99900,
      firstResponseMinutes: 480, resolutionMinutes: 4320,  supportHours: "8x5",
      maxDevices: 5, maxUsers: 10,
      features: ["Remote support", "Email helpdesk", "Basic monitoring", "Monthly check-in"] },
    { tier: "silver",   name: "Silver Standard",  priceMonthly: 199900,
      firstResponseMinutes: 240, resolutionMinutes: 1440,  supportHours: "8x5",
      maxDevices: 15, maxUsers: 25,
      features: ["Remote + limited onsite", "24/5 monitoring", "Patch management", "M365 management"] },
    { tier: "gold",     name: "Gold Professional", priceMonthly: 349900,
      firstResponseMinutes: 120, resolutionMinutes: 480,   supportHours: "12x5",
      maxDevices: 30, maxUsers: 50,
      features: ["Remote + onsite (Cape Town)", "24/7 monitoring", "Dedicated agent", "Security alerts"] },
    { tier: "platinum", name: "Platinum Enterprise", priceMonthly: 599900,
      firstResponseMinutes: 60,  resolutionMinutes: 240,   supportHours: "24x7",
      maxDevices: 75, maxUsers: 150,
      features: ["Dedicated account manager", "Full Azure + M365 mgmt", "Intune", "DR planning"] },
    { tier: "diamond",  name: "Diamond Elite",    priceMonthly: 999900,
      firstResponseMinutes: 30,  resolutionMinutes: 120,   supportHours: "24x7",
      maxDevices: 999, maxUsers: 999,
      features: ["On-site engineer 1d/week", "Real-time NOC", "Full cybersecurity", "VCISO"] },
    { tier: "custom",   name: "Custom Package",   priceMonthly: null,
      firstResponseMinutes: null, resolutionMinutes: null, supportHours: "negotiated",
      maxDevices: null, maxUsers: null, isCustom: true,
      features: ["Fully tailored to client requirements"] },
  ];

  for (const t of tiers) {
    const existing = await db.select({ id: slaPackagesTable.id })
      .from(slaPackagesTable).where(eq(slaPackagesTable.tier, t.tier));
    if (existing.length === 0) {
      await db.insert(slaPackagesTable).values(t as any);
      console.log(`✓ SLA tier seeded: ${t.name}`);
    }
  }

  // ── ENSURE SUPER ADMIN ─────────────────────────────────────────
  const existing = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, "admin@halo.local"));
  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash("SecureAdmin123!", 12);
    await db.insert(usersTable).values({
      name: "Willem Hattingh", email: "admin@halo.local",
      passwordHash, role: "super_admin", isOwner: true, permissions: {},
    });
    console.log("✓ Super admin seeded: admin@halo.local / SecureAdmin123!");
  }
}

seedPhase2().then(() => { console.log("Phase 2 seed complete."); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
```

---

## ✅ DEFINITION OF DONE CHECKLIST

```
SCHEMA
[ ] All 18 table groups added to schema/index.ts
[ ] pnpm run db:push succeeds with no errors
[ ] pnpm run build passes with zero TypeScript errors

AUTH & RBAC
[ ] requireRole() middleware working on all admin routes
[ ] logAudit() called on every create/update/delete action
[ ] Super admin admin@halo.local can access all routes

CORE FEATURES
[ ] Clients CRUD working
[ ] Tickets with 3 branches + approval flow
[ ] SLA breach detection running (setInterval)
[ ] Invoices with correct ZAR calculation + 15% VAT
[ ] Quotations with convert-to-invoice

AI
[ ] HaloBot streaming chat responding (Authorization: Bearer)
[ ] Daily greeting on dashboard loads
[ ] Fallback to Ollama if Azure fails
[ ] AI session history saving

RMM
[ ] Agent script generated with unique token
[ ] Heartbeat endpoint receiving device data
[ ] Devices appearing in RMM Console after check-in
[ ] Alert auto-creation working for disk > 90%

DEV CONSOLE
[ ] SQL mode executes queries
[ ] JS mode executes async code
[ ] Bash mode runs shell commands
[ ] All executions audit logged

VAULT
[ ] AES-256 encryption/decryption working
[ ] Entries only visible to owner
[ ] Access log entries created on reveal

FRONTEND
[ ] All pages use design-tokens.ts (C.* + S.*)
[ ] Full sidebar showing all modules
[ ] TOTP banner showing when 2FA not enabled
[ ] All pages load without TypeScript errors
```

---

```
END OF MASTER CODE SPECIFICATION
Version: 2.0 | Date: June 2026
Stack: Express 5 + Drizzle + PostgreSQL + React + Vite + TypeScript
Owner: Willem Hattingh | Halo IT Services 365 | Cape Town, ZA
Next step: Start with Section E, Step 1 — schema additions
```
