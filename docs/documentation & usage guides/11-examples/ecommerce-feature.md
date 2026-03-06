# Full-Stack E-Commerce Feature

> **Level:** Intermediate | **Time:** 30 minutes | **Sessions:** 1 coordinator + 3 workers

Build a product catalog, shopping cart, and checkout flow using a coordinator that breaks down work and delegates it to specialized workers.

---

## What you build

A full-stack e-commerce feature with five components:

- Product catalog API (backend)
- Shopping cart logic (backend)
- Checkout page (frontend)
- Payment integration (backend)
- End-to-end tests

## Prerequisites

- Maestro installed (`maestro status` returns a response)
- Completed the [Blog API example](./blog-api.md) (recommended)
- An existing project directory (e.g., `~/projects/ecommerce-app`)

---

## Step 1: Create the project and team members

### Create the project

```bash
maestro project create "E-Commerce App" --working-dir ~/projects/ecommerce-app
export MAESTRO_PROJECT_ID=<project-id>
```

### Create specialized team members

Team members define agent personas with specific roles, identities, and permissions.

```bash
# Backend developer
maestro team-member create "Backend Dev" \
  --role "Senior Backend Engineer" \
  --identity "You are a senior backend engineer specializing in Node.js, Express, and PostgreSQL. You write clean, well-tested REST APIs with proper error handling and input validation." \
  --avatar "🔧" \
  --mode coordinated-worker \
  --permission-mode acceptEdits

# Frontend developer
maestro team-member create "Frontend Dev" \
  --role "Senior Frontend Engineer" \
  --identity "You are a senior frontend engineer specializing in React and TypeScript. You build accessible, responsive UI components with proper state management." \
  --avatar "🎨" \
  --mode coordinated-worker \
  --permission-mode acceptEdits

# QA engineer
maestro team-member create "QA Engineer" \
  --role "QA Engineer" \
  --identity "You are a QA engineer who writes thorough end-to-end tests. You test happy paths, error cases, and edge cases. You use Playwright for E2E tests and Jest for integration tests." \
  --avatar "🧪" \
  --mode coordinated-worker \
  --permission-mode acceptEdits
```

```
Team member created:
  ID:   tm_1772040400000_backend
  Name: Backend Dev
  Role: Senior Backend Engineer
  Mode: coordinated-worker

Team member created:
  ID:   tm_1772040400000_frontend
  Name: Frontend Dev
  Role: Senior Frontend Engineer
  Mode: coordinated-worker

Team member created:
  ID:   tm_1772040400000_qa
  Name: QA Engineer
  Role: QA Engineer
  Mode: coordinated-worker
```

### Create a team

Group your team members into a team with a leader.

```bash
maestro team create "E-Commerce Team" \
  --desc "Full-stack team for e-commerce feature development" \
  --leader tm_1772040400000_backend \
  --members tm_1772040400000_backend,tm_1772040400000_frontend,tm_1772040400000_qa \
  --avatar "🛒"
```

```
Team created:
  ID:      team_1772040400000_ecom
  Name:    E-Commerce Team
  Members: 3
  Leader:  Backend Dev
```

---

## Step 2: Create the task hierarchy

Create a parent task, then break it into subtasks.

### Parent task

```bash
maestro task create "Build e-commerce feature" \
  --desc "Implement a complete e-commerce feature including product catalog, shopping cart, checkout page, payment integration, and end-to-end tests." \
  --priority high
```

```
Task created:
  ID:       task_1772040500000_parent
  Title:    Build e-commerce feature
  Status:   todo
  Priority: high
```

### Subtasks

```bash
# Product catalog API
maestro task create "Build product catalog API" \
  --desc "Create REST endpoints for the product catalog. GET /api/products returns paginated product list with filtering by category and price range. GET /api/products/:id returns a single product with full details. POST /api/products creates a new product (admin only). Use PostgreSQL for storage. Include proper pagination with limit/offset." \
  --priority high \
  --parent task_1772040500000_parent

# Shopping cart
maestro task create "Implement shopping cart" \
  --desc "Build the shopping cart backend. POST /api/cart/items adds a product to the cart (requires auth). GET /api/cart returns the current cart with item details and total price. PATCH /api/cart/items/:id updates item quantity. DELETE /api/cart/items/:id removes an item. Cart is stored per-user in the database. Calculate totals including tax." \
  --priority high \
  --parent task_1772040500000_parent

# Checkout page
maestro task create "Build checkout page" \
  --desc "Create a React checkout page component. Display cart summary with product names, quantities, and prices. Include a shipping address form with validation. Include a payment method selection (credit card form). Show order total with tax and shipping. Add a 'Place Order' button that calls the checkout API. Handle loading states and errors gracefully." \
  --priority high \
  --parent task_1772040500000_parent

# Payment integration
maestro task create "Integrate payment processing" \
  --desc "Integrate Stripe for payment processing. POST /api/checkout creates a Stripe PaymentIntent with the cart total. Handle webhook events for payment_intent.succeeded and payment_intent.failed. Update order status based on payment result. Use Stripe test mode keys. Include proper error handling for declined cards and network failures." \
  --priority medium \
  --parent task_1772040500000_parent

# E2E tests
maestro task create "Write end-to-end tests" \
  --desc "Write Playwright E2E tests for the complete purchase flow. Test: browse products, add item to cart, view cart, proceed to checkout, fill shipping form, complete payment with test card, verify order confirmation page. Also test error cases: empty cart checkout, invalid shipping address, declined card. Use Stripe test card numbers." \
  --priority medium \
  --parent task_1772040500000_parent
```

### View the task tree

```bash
maestro task tree
```

```
Build e-commerce feature (task_1772040500000_parent) [todo] high
├── Build product catalog API (task_1772040500000_catalog) [todo] high
├── Implement shopping cart (task_1772040500000_cart) [todo] high
├── Build checkout page (task_1772040500000_checkout) [todo] high
├── Integrate payment processing (task_1772040500000_payment) [todo] medium
└── Write end-to-end tests (task_1772040500000_tests) [todo] medium
```

---

## Step 3: Spawn the coordinator

The coordinator reads the tasks, analyzes dependencies, and spawns worker sessions to execute them.

```bash
maestro session spawn \
  --task task_1772040500000_parent \
  --mode coordinator \
  --name "ecommerce-coordinator"
```

```
Session spawned:
  ID:     sess_1772040600000_coord
  Name:   ecommerce-coordinator
  Mode:   coordinator
  Status: spawning
```

The coordinator:

1. Reads the parent task and all subtasks
2. Identifies which tasks can run in parallel (catalog + checkout)
3. Identifies dependencies (tests depend on everything else)
4. Spawns worker sessions with appropriate team members
5. Monitors progress and handles failures

---

## Step 4: Watch the coordinator work

### View active sessions

```bash
maestro session list --status working
```

```
Active sessions:

  ID                              Name                    Mode         Status   Tasks
  sess_1772040600000_coord        ecommerce-coordinator   coordinator  working  1
  sess_1772040600000_back1        backend-catalog         worker       working  1
  sess_1772040600000_front1       frontend-checkout       worker       working  1
```

The coordinator spawns backend and frontend workers in parallel. The catalog API and checkout page have no dependencies on each other.

### Monitor a specific worker

```bash
maestro session logs sess_1772040600000_back1 --follow
```

### Track task progress

```bash
maestro task get task_1772040500000_catalog
```

```
Task: Build product catalog API
  ID:       task_1772040500000_catalog
  Status:   in_progress
  Priority: high

  Timeline:
    [5 min ago]  Assigned to session sess_1772040600000_back1
    [4 min ago]  Progress: Setting up Express routes and PostgreSQL connection
    [2 min ago]  Progress: GET /api/products endpoint complete with pagination
    [1 min ago]  Progress: Working on POST /api/products with admin auth check
```

### View all task statuses at once

```bash
maestro task children task_1772040500000_parent
```

```
Subtasks of "Build e-commerce feature":

  ID                              Title                         Status        Priority
  task_1772040500000_catalog      Build product catalog API     completed     high
  task_1772040500000_cart          Implement shopping cart       in_progress   high
  task_1772040500000_checkout     Build checkout page           completed     high
  task_1772040500000_payment      Integrate payment processing  in_progress   medium
  task_1772040500000_tests        Write end-to-end tests        todo          medium
```

Notice the coordinator started the tests task only after the other tasks completed. It understands the dependency: E2E tests need working endpoints and UI.

---

## Step 5: Handle issues

If a worker session gets stuck or needs input, the coordinator detects it.

### Check for sessions needing input

```bash
maestro session list --status idle
```

```
Idle sessions:

  ID                              Name               Mode    Status  Needs Input
  sess_1772040600000_pay1         backend-payment     worker  idle    Yes: "Need Stripe test API keys"
```

### Provide input to a blocked session

```bash
maestro session prompt sess_1772040600000_pay1 \
  --message "Use Stripe test keys: pk_test_example123 and sk_test_example456. These are test mode keys for development."
```

The session resumes working with the provided information.

---

## Step 6: Review the completed feature

Once all workers finish, the coordinator marks the parent task as completed.

```bash
maestro task tree
```

```
Build e-commerce feature (task_1772040500000_parent) [completed] high
├── Build product catalog API (task_1772040500000_catalog) [completed] high
├── Implement shopping cart (task_1772040500000_cart) [completed] high
├── Build checkout page (task_1772040500000_checkout) [completed] high
├── Integrate payment processing (task_1772040500000_payment) [completed] medium
└── Write end-to-end tests (task_1772040500000_tests) [completed] medium
```

```bash
maestro session list
```

```
All sessions:

  ID                              Name                    Mode         Status     Tasks  Duration
  sess_1772040600000_coord        ecommerce-coordinator   coordinator  completed  1      25 min
  sess_1772040600000_back1        backend-catalog         worker       completed  1      8 min
  sess_1772040600000_back2        backend-cart            worker       completed  1      10 min
  sess_1772040600000_front1       frontend-checkout       worker       completed  1      12 min
  sess_1772040600000_pay1         backend-payment         worker       completed  1      9 min
  sess_1772040600000_test1        qa-tests                worker       completed  1      7 min
```

---

## How the coordinator orchestrated this

```
                    ┌──────────────────────┐
                    │  Coordinator Session  │
                    │  ecommerce-coordinator│
                    └─────────┬────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌──────▼──────┐
        │  Backend   │  │  Backend   │  │  Frontend   │
  Wave 1│  Catalog   │  │  Cart      │  │  Checkout   │
        │  Worker    │  │  Worker    │  │  Worker     │
        └─────┬─────┘  └─────┬─────┘  └──────┬──────┘
              │               │               │
              └───────┬───────┘               │
                      │                       │
                ┌─────▼─────┐                 │
  Wave 2        │  Payment   │                │
                │  Worker    │                │
                └─────┬─────┘                 │
                      │                       │
              ┌───────┴───────────────────────┘
              │
        ┌─────▼─────┐
  Wave 3│  E2E Tests │
        │  Worker    │
        └───────────┘
```

The coordinator automatically:

- **Wave 1:** Spawned catalog, cart, and checkout workers in parallel (no dependencies)
- **Wave 2:** Spawned payment worker after catalog and cart completed (needs API endpoints)
- **Wave 3:** Spawned test worker after all feature work completed (needs everything)

---

## Full command summary

```bash
# 1. Project setup
maestro project create "E-Commerce App" --working-dir ~/projects/ecommerce-app
export MAESTRO_PROJECT_ID=<project-id>

# 2. Team members
maestro team-member create "Backend Dev" --role "Senior Backend Engineer" \
  --identity "..." --avatar "🔧" --mode coordinated-worker --permission-mode acceptEdits
maestro team-member create "Frontend Dev" --role "Senior Frontend Engineer" \
  --identity "..." --avatar "🎨" --mode coordinated-worker --permission-mode acceptEdits
maestro team-member create "QA Engineer" --role "QA Engineer" \
  --identity "..." --avatar "🧪" --mode coordinated-worker --permission-mode acceptEdits

# 3. Team
maestro team create "E-Commerce Team" \
  --desc "Full-stack team for e-commerce feature development" \
  --leader <backend-tm-id> \
  --members <backend-tm-id>,<frontend-tm-id>,<qa-tm-id>

# 4. Tasks (parent + subtasks)
maestro task create "Build e-commerce feature" --priority high
maestro task create "Build product catalog API" --priority high --parent <parent-task-id>
maestro task create "Implement shopping cart" --priority high --parent <parent-task-id>
maestro task create "Build checkout page" --priority high --parent <parent-task-id>
maestro task create "Integrate payment processing" --priority medium --parent <parent-task-id>
maestro task create "Write end-to-end tests" --priority medium --parent <parent-task-id>

# 5. Spawn coordinator
maestro session spawn --task <parent-task-id> --mode coordinator --name "ecommerce-coordinator"

# 6. Monitor
maestro session list --status working
maestro task tree
maestro session logs <session-id> --follow
```

---

## What you learned

- **Team members** define agent personas with roles, identities, and permissions
- **Teams** group team members and set a leader
- **Task hierarchies** use parent/child relationships to organize complex work
- **Coordinators** automatically analyze tasks, identify dependencies, and spawn workers
- **Parallel execution** runs independent tasks simultaneously for faster delivery
- **Wave-based orchestration** respects dependencies between tasks
- **Session prompting** lets you provide input to sessions that need information

## Next steps

- [Monorepo Migration](./monorepo-migration.md) — Coordinate work across multiple projects with master sessions
- [Team Members Guide](/docs/guides/team-members) — Deep dive into team member configuration
- [Coordinator Patterns](/docs/guides/coordinator) — Advanced coordinator workflows
