                                     
⏺ Testing Scenarios for Production     
  Phase 1                              
                                       
  Here are 4 comprehensive test        
  scenarios you can run on the UI to   
  verify all new features:             
                                       
  ---                                  
  Test 1: Complete Task Lifecycle with 
  Subtask Persistence ✅               
                                       
  Tests: Task management + Subtask     
  persistence (Module 4) + CLI         
  enhancements (Module 2)              
                                       
  Setup                                
                                       
  export                               
  MAESTRO_PROJECT_ID="test-project-1"  
  export MAESTRO_API_URL="http://localh
  ost:3000"                            
                                       
  # Create a task                      
  maestro task create "Implement User  
  Authentication" \                    
    --desc "Add JWT-based auth with    
  login, signup, and password reset" \ 
    --priority high                    
                                       
  # Copy the task ID from output (e.g.,
   task_1706892345123_abc123xyz)       
  export MAESTRO_TASK_ID="<task_id_from
  _above>"                             
                                       
  Test Steps                           
                                       
  1. UI Verification - Task Created:   
    - Navigate to the Tasks view       
    - Verify task appears with title,  
  description, priority (high), and    
  status (pending)                     
    - Verify timeline shows "Task      
  created" event                       
  2. Add Subtasks (via CLI):           
  maestro subtask create               
  $MAESTRO_TASK_ID "Install and        
  configure JWT library"               
  maestro subtask create               
  $MAESTRO_TASK_ID "Create User model  
  with password hashing"               
  maestro subtask create               
  $MAESTRO_TASK_ID "Implement login    
  endpoint"                            
  maestro subtask create               
  $MAESTRO_TASK_ID "Implement signup   
  endpoint"                            
  maestro subtask create               
  $MAESTRO_TASK_ID "Add authentication 
  middleware"                          
                                       
  3. UI Verification - Subtasks        
  Visible:                             
    - Click on the task to expand it   
    - Verify subtasks appear in the UI 
  with statuses (uncompleted = ⬜)     
    - Count should be 5 subtasks       
  4. Start Working on Task:            
  maestro task start $MAESTRO_TASK_ID  
  maestro update "Beginning            
  implementation. Will start with JWT  
  library setup."                      
                                       
  5. UI Verification - Status Change:  
    - Task status changes from         
  "pending" to "in_progress" 🔄        
    - Timeline shows "Started" event   
    - Timeline shows progress update   
  message                              
  6. Complete Subtasks (via CLI):      
  # Get subtasks list                  
  maestro subtask list $MAESTRO_TASK_ID
   --json                              
                                       
  # Copy first subtask ID and complete 
  it                                   
  maestro subtask complete             
  $MAESTRO_TASK_ID <subtask_id_1>      
  maestro update "Installed JWT library
   and dependencies"                   
                                       
  # Complete another                   
  maestro subtask complete             
  $MAESTRO_TASK_ID <subtask_id_2>      
  maestro update "User model created   
  with bcrypt hashing"                 
                                       
  7. UI Verification - Subtask         
  Completion:                          
    - Subtasks show completion status  
  (✅ for completed, ⬜ for incomplete)
    - Refresh the page - verify        
  subtasks still persist (not lost)    
    - Timeline shows subtask           
  completions                          
  8. Block Task (Test Error Handling): 
  # Block the task with a reason       
  maestro task block $MAESTRO_TASK_ID  
  --reason "Waiting for security review
   approval"                           
                                       
  9. UI Verification - Task Blocked:   
    - Task status changes to "blocked" 
  🚫                                   
    - Timeline shows "Blocked" event   
  with reason                          
    - Red indicator on task card       
                                       
  What to Verify ✓                     
                                       
  - Task persists after page refresh   
  - Subtasks visible and count correct 
  - Subtask completion marked visually 
  (✅/⬜)                              
  - Subtasks still there after page    
  refresh (persistence!)               
  - Timeline shows all events in order 
  - Progress messages appear in        
  timeline                             
  - Task status transitions work       
  (pending → in_progress → blocked)    
  - Task colors/icons change           
  appropriately                        
                                       
  ---                                  
  Test 2: Multi-Agent Orchestration    
  with Session Spawning 🚀             
                                       
  Tests: Session spawning (Module 3) + 
  Task-Session relationships +         
  WebSocket sync                       
                                       
  Setup                                
                                       
  export                               
  MAESTRO_PROJECT_ID="test-project-2"  
                                       
  # Create a high-level task           
  (Orchestrator task)                  
  maestro task create "Implement       
  Payment Processing System" \         
    --desc "Add Stripe integration with
   webhooks" \                         
    --priority high                    
                                       
  export ORCHESTRATOR_TASK_ID="<task_id
  _from_above>"                        
                                       
  # Create a subtask that will be      
  delegated to workers                 
  maestro subtask create               
  $ORCHESTRATOR_TASK_ID "Implement     
  payment endpoints"                   
  maestro subtask create               
  $ORCHESTRATOR_TASK_ID "Add webhook   
  handlers"                            
                                       
  # Mark orchestrator task as in       
  progress                             
  maestro task start                   
  $ORCHESTRATOR_TASK_ID                
  maestro update "Starting payment     
  system implementation. Planning to   
  delegate work to specialists."       
                                       
  Test Steps                           
                                       
  1. UI Verification - Orchestrator    
  Context:                             
    - Navigate to Tasks view           
    - See "Implement Payment Processing
   System" task                        
    - Verify it shows "in_progress"    
  status                               
    - Verify timeline shows planning   
  messages                             
  2. Spawn Worker Session #1 (Backend  
  Worker):                             
  export MAESTRO_SESSION_ID="orchestrat
  or-session"                          
                                       
  maestro session spawn \              
    --task $ORCHESTRATOR_TASK_ID \     
    --name "Payment Backend Worker" \  
    --skill maestro-worker             
                                       
  3. UI Verification - Spawn Request   
  Received:                            
    - Look for a new terminal tab      
  opening (Tauri integration - may show
   notification)                       
    - Check Sessions view:             
        - New session appears: "Payment
   Backend Worker"                     
      - Status shows "spawning"        
  (transitioning to "running")         
      - Session linked to the task     
    - Task view:                       
        - Shows "1 active session"     
  indicator                            
      - Session ID visible in task     
  details                              
  4. Verify Environment Injection (in  
  spawned terminal):                   
  # In the new terminal that was       
  spawned, run:                        
  maestro whoami --json                
                                       
  # Should output:                     
  # {                                  
  #   "projectId": "test-project-2",   
  #   "sessionId":                     
  "<spawned_session_id>",              
  #   "taskIds": ["<task_id>"],        
  #   "server": "http://localhost:3000"
  # }                                  
                                       
  5. Worker Starts Implementing:       
  # In the spawned worker terminal:    
  maestro task start                   
  maestro update "Setting up Stripe    
  client library and configuration"    
                                       
  maestro subtask complete <task_id>   
  <subtask_id_for_endpoints>           
  maestro update "Payment endpoints    
  implemented and tested. Ready for    
  review."                             
                                       
  6. UI Verification - Real-time       
  WebSocket Sync:                      
    - Don't refresh the page - use     
  WebSocket events                     
    - Watch the task update in         
  real-time:                           
        - Worker's progress updates    
  appear in timeline instantly         
      - Subtask completion shows       
  immediately (✅ mark)                
    - Sessions view:                   
        - Worker session shows         
  activity/last update time            
  7. Spawn Worker Session #2 (Webhook  
  Worker):                             
  # From orchestrator session, spawn   
  another worker                       
  maestro session spawn \              
    --task $ORCHESTRATOR_TASK_ID \     
    --name "Webhook Handler Worker" \  
    --skill maestro-worker             
                                       
  8. UI Verification - Multiple        
  Sessions:                            
    - Task now shows "2 active         
  sessions"                            
    - Sessions view shows both workers 
    - Tasks view shows task is being   
  worked on by 2 concurrent workers    
                                       
  What to Verify ✓                     
                                       
  - Session spawn command succeeds (no 
  errors)                              
  - New terminal window/tab opens with 
  correct name                         
  - Session status transitions from    
  "spawning" → "running"               
  - Environment variables injected     
  correctly (maestro whoami works)     
  - Worker can see assigned task via   
  context                              
  - Real-time WebSocket updates - no   
  need to refresh to see changes       
  - Multiple sessions can work on same 
  task simultaneously                  
  - Task-session relationship visible  
  in both directions                   
  - Timeline shows all worker activity 
  in order                             
                                       
  ---                                  
  Test 3: Error Handling and CLI       
  Reliability 🛡️                       
                                       
  Tests: CLI enhancements (Module 2) - 
  Error handling + Retry logic         
                                       
  Setup                                
                                       
  export                               
  MAESTRO_PROJECT_ID="test-project-3"  
                                       
  # Create a task for testing          
  maestro task create "Test Feature"   
  --priority medium                    
  export TEST_TASK_ID="<task_id>"      
                                       
  Test Steps                           
                                       
  1. Test Error Handling - Invalid Task
   ID:                                 
  # Try to get non-existent task       
  maestro task get invalid_task_id     
  --json                               
                                       
  # Should see structured error:       
  # {                                  
  #   "success": false,                
  #   "error": "resource_not_found",   
  #   "message": "Resource not found", 
  #   "suggestion": "Use list commands 
  to see available resources"          
  # }                                  
                                       
  2. UI Verification - Error Context:  
    - CLI shows clear error message ❌ 
    - Suggestion tells what to do next 
    - Non-technical users can          
  understand it                        
  3. Test Missing Required Field:      
  # Try to block task without reason   
  (required field)                     
  maestro task block $TEST_TASK_ID     
                                       
  # Should show validation error       
                                       
  4. UI Verification:                  
    - Clear message: "reason is        
  required"                            
    - Example of valid usage shown     
  5. Test Status Command:              
  maestro status --json                
                                       
  # Should output project statistics   
                                       
  6. UI Verification - Status          
  Dashboard:                           
    - Shows task counts by status      
    - Shows task counts by priority    
    - Shows active session count       
    - Useful for orchestrator planning 
  7. Test Retry Logic (Network         
  Resilience):                         
  # Enable debug to see retries        
  export MAESTRO_DEBUG=true            
                                       
  # While server is temporarily        
  unavailable:                         
  # 1. Stop the Maestro server briefly 
  # 2. Run a command:                  
  maestro task list                    
                                       
  # Observe: Command waits, retries    
  automatically, succeeds when server  
  restarts                             
                                       
  8. UI Verification - CLI Resilience: 
    - Command eventually succeeds      
  (doesn't fail immediately)           
    - Debug output shows retry attempts
    - No data loss when connection     
  recovers                             
  9. Test JSON Output for Automation:  
  maestro task list --json             
                                       
  # Verify output is valid JSON        
  (parseable by scripts/LLMs)          
  maestro task list --json | jq '.[] | 
  select(.status=="pending")'          
                                       
  # Should filter results correctly    
                                       
  What to Verify ✓                     
                                       
  - Error messages are clear and       
  actionable                           
  - Structured error JSON includes     
  error code and suggestion            
  - Validation catches missing required
   fields                              
  - maestro status shows useful project
   overview                            
  - Retry logic works - commands       
  succeed after connection recovery    
  - JSON output is valid - can be      
  parsed by other tools                
  - CLI works both in human-readable   
  and machine-readable modes           
  - No crashes or unclear errors       
                                       
  ---                                  
  Test 4: Comprehensive Cross-Feature  
  Workflow 🎯                          
                                       
  Tests: Everything together -         
  realistic multi-agent scenario       
                                       
  Scenario: "Build a new API feature   
  with team"                           
                                       
  Setup                                
                                       
  export MAESTRO_PROJECT_ID="test-proje
  ct-complete"                         
                                       
  # Orchestrator creates initial task  
  maestro task create "Build User      
  Profile Management API" \            
    --desc "Implement endpoints for    
  viewing and updating user profiles   
  with role-based access control" \    
    --priority high                    
                                       
  export MAIN_TASK_ID="<task_id>"      
  maestro task start $MAIN_TASK_ID     
  maestro update "Received feature     
  request. Decomposing into subtasks   
  for team implementation."            
                                       
  Test Steps                           
                                       
  1. Orchestrator Decomposes Work      
  (Subtasks):                          
  maestro subtask create $MAIN_TASK_ID 
  "Create User Profile database schema 
  with migrations"                     
  maestro subtask create $MAIN_TASK_ID 
  "Implement GET /api/profiles/:id     
  endpoint"                            
  maestro subtask create $MAIN_TASK_ID 
  "Implement PATCH /api/profiles/:id   
  endpoint (with RBAC)"                
  maestro subtask create $MAIN_TASK_ID 
  "Write integration tests for all     
  endpoints"                           
  maestro subtask create $MAIN_TASK_ID 
  "Update API documentation"           
                                       
  maestro update "Decomposed into 5    
  subtasks. Ready to delegate to team."
                                       
  2. UI Verification - Task Breakdown: 
    - See 5 subtasks listed            
    - All marked as incomplete (⬜)    
    - Task shows no active sessions yet
  3. Spawn Database Worker:            
  maestro session spawn \              
    --task $MAIN_TASK_ID \             
    --name "Database Schema Worker" \  
    --skill maestro-worker             
                                       
  4. In Database Worker Terminal:      
  maestro update "Starting database    
  schema design"                       
  maestro subtask complete             
  $MAIN_TASK_ID <subtask_id_1>         
  maestro update "Created User Profile 
  schema with migrations. Ready for    
  review."                             
                                       
  5. Spawn API Backend Worker:         
  # From orchestrator session          
  maestro session spawn \              
    --task $MAIN_TASK_ID \             
    --name "API Implementation Worker" 
  \                                    
    --skill maestro-worker             
                                       
  6. In API Worker Terminal:           
  maestro update "Starting endpoint    
  implementation"                      
  maestro subtask complete             
  $MAIN_TASK_ID <subtask_id_2>         
  maestro update "GET endpoint         
  completed and tested"                
                                       
  maestro subtask complete             
  $MAIN_TASK_ID <subtask_id_3>         
  maestro update "PATCH endpoint       
  implemented with role-based access   
  control"                             
                                       
  7. Spawn Testing Worker:             
  maestro session spawn \              
    --task $MAIN_TASK_ID \             
    --name "Testing & Documentation    
  Worker" \                            
    --skill maestro-worker             
                                       
  8. In Testing Worker Terminal:       
  maestro update "Running integration  
  test suite"                          
  maestro subtask complete             
  $MAIN_TASK_ID <subtask_id_4>         
  maestro update "All endpoint tests   
  passing (24/24)"                     
                                       
  maestro subtask complete             
  $MAIN_TASK_ID <subtask_id_5>         
  maestro update "API documentation    
  updated with examples and            
  authentication"                      
                                       
  UI Verification - Real-time          
  Multi-Worker Progress ✓              
                                       
  Main Orchestrator View:              
  - Task shows "3 active sessions"     
  - Subtask completion progresses from 
  0/5 → 1/5 → 2/5 → 5/5                
  - No page refresh needed - all       
  updates appear in real-time          
  - Timeline shows updates from all 3  
  workers in order                     
  - Color-coded progress: incomplete   
  (grey) → complete (green)            
                                       
  Sessions View:                       
  - 3 worker sessions listed with names
  - Each shows active/running status   
  - "Last activity" timestamp updates  
  as workers post messages             
  - Can see which session posted which 
  update                               
                                       
  Task Completion:                     
  # Back in orchestrator session,      
  verify completion                    
  maestro task get $MAIN_TASK_ID --json
   | jq '.subtasks'                    
                                       
  # All should show "completed": true  
                                       
  4. Complete Main Task:               
  maestro task complete $MAIN_TASK_ID  
  maestro update "All subtasks         
  complete. All tests passing. Feature 
  ready for deployment."               
                                       
  UI Verification - Completion ✓       
                                       
  - Task status changes to "completed" 
  ✅                                   
  - All subtasks marked complete       
  - Timeline shows final completion    
  message                              
  - Session list shows 3 sessions with 
  history                              
  - No data loss throughout entire     
  workflow                             
                                       
  ---                                  
  Summary: What Each Test Validates    
  Test: Test 1                         
  Validates: Subtask Persistence + Task
                                       
    Management                         
  Key Features: Module 4 + Module 2    
    (block command)                    
  ─────────────────────────────────────
  ─                                    
  Test: Test 2                         
  Validates: Session Spawning +        
    Multi-Agent Orchestration          
  Key Features: Module 3 + WebSocket   
    sync                               
  ─────────────────────────────────────
  ─                                    
  Test: Test 3                         
  Validates: CLI Robustness + Error    
    Handling                           
  Key Features: Module 2 (error        
  handling                             
     + retry logic)                    
  ─────────────────────────────────────
  ─                                    
  Test: Test 4                         
  Validates: Full End-to-End Workflow  
  Key Features: All modules together   
  ---                                  
  Verification Checklist               
                                       
  ✓ Foundational Features (Working)    
    ✓ Create, list, get, update tasks  
    ✓ Task status transitions          
    ✓ Task timeline tracking           
    ✓ Project context management       
                                       
  ✓ Module 2: CLI Enhancements         
    ✓ maestro task block command       
    ✓ maestro status command           
    ✓ Structured error messages        
    ✓ Retry logic with exponential     
  backoff                              
    ✓ JSON output for automation       
                                       
  ✓ Module 4: Subtask Persistence      
    ✓ Create subtasks via CLI          
    ✓ Subtasks persist after page      
  refresh                              
    ✓ Mark subtasks as complete        
    ✓ Subtask timeline events          
    ✓ Real-time WebSocket sync         
                                       
  ✓ Module 3: Session Spawning         
    ✓ maestro session spawn command    
    ✓ Session created in DB            
    ✓ Environment variables injected   
    ✓ Task-session relationships       
    ✓ Multiple sessions per task       
    ✓ Real-time progress updates (no   
  refresh)                             
                                       
  ✓ WebSocket Reliability (Bonus)      
    ✓ Events broadcast to all connected
   clients                             
    ✓ No loss of updates when switching
   tabs                                
    ✓ Concurrent operations sync       
  correctly                            
    ✓ High-frequency updates handled   
  smoothly                             
                                       
  ---                                  
  Pro Tips for Testing:                
  - Open the UI in two browser windows 
  during Test 2 & 4 to verify real-time
   sync                                
  - Use maestro task get <id> --json | 
  jq to verify data integrity in CLI   
  - Watch the browser Network tab to   
  see WebSocket messages in real-time  
  - Keep the browser console open to   
  spot any JavaScript errors           
  - Test on slower network (DevTools   
  throttle) to verify retry logic      
                                       
  Good luck testing! 🚀                
                                       
✻ Cogitated for 42s                    
                                       
───────────────────────────────────────
❯                                      
───────────────────────────────────────
  --      ⏵⏵ accept  Update            
  INSERT  edits on   available! Run:   
  --      (shift+tab brew upgrade      
          to cycle)  claude-code       
                                       
zsh: killed     claude