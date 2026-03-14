# AI-Assisted Development Prompt Library

## Use this file as a reference for effective prompts to ask the AI

---

## 🎯 Algorithm Improvements

### Ranking System Enhancement
```
Prompt: "I want to improve the player ranking system to better reflect 
recent performance. Currently it's based on total wins/losses. 

Suggest a weighted algorithm where:
- Matches in the last 3 rounds count 1.5x
- Matches 4-6 rounds ago count 1x
- Matches 7+ rounds ago count 0.5x

Show the complete algorithm, explain the benefits, and provide unit tests."
```

### Skill-Based Group Generation
```
Prompt: "The group generation currently just pairs players sequentially, 
which sometimes creates unbalanced groups. 

Create an algorithm that:
1. Calculates a 'skill score' for each player
2. Distributes players across groups to balance total skill
3. Handles both 4 and 5-player groups

Show complete code with comments and test cases."
```

### Match Prediction System
```
Prompt: "Add a function that predicts match outcomes based on:
- Each player's win rate
- Recent performance trend
- Head-to-head history if available

Provide a confidence score (0-100) with each prediction.
Include unit tests with sample data."
```

### Player Consistency Scoring
```
Prompt: "Create a 'consistency score' that measures how stable a player's 
performance is:
- High consistency = expected performance each match
- Low consistency = unpredictable results

Show how to calculate it from match history and 
how to use it in the ranking formula."
```

---

## 🎨 UI/Styling Improvements

### Dashboard Redesign
```
Prompt: "Redesign the main tournament dashboard to show:
1. Current standings in each category
2. Upcoming matches this round
3. Player statistics (win %, average score spread)
4. Recent match results

Make it clean, modern, and mobile-friendly. 
Show the HTML structure and CSS with before/after comparison."
```

### Admin Panel Enhancement
```
Prompt: "Improve the admin panel with:
1. Better visual hierarchy
2. Quick action buttons
3. Data visualization for statistics
4. Dark mode support

Provide the updated CSS and explain the design improvements."
```

### Mobile Responsive Update
```
Prompt: "Make the entire UI mobile-responsive with:
- Hamburger menu for navigation
- Adjusted card layouts for small screens
- Touch-friendly button sizes
- Vertical match displays

Show CSS media queries and layout changes."
```

### Custom Theme System
```
Prompt: "Create a theme system that supports:
1. Light mode (current)
2. Dark mode
3. High contrast mode for accessibility

Show how to implement theme switching and store user preference."
```

---

## 📊 Feature Additions

### Player Statistics View
```
Prompt: "Add a detailed statistics page for each player showing:
1. Win rate by opponent
2. Win rate by round number
3. Performance trend (improving/declining graph)
4. Head-to-head matchups
5. Strengths (best in which groups)

Provide the data calculation functions and UI layout."
```

### Tournament History Analysis
```
Prompt: "Create a tournament history view that shows:
1. Player movement through categories
2. Win/loss streaks
3. Biggest upsets
4. Most consistent performers

Provide backend endpoints and frontend visualization."
```

### Export/Report Generation
```
Prompt: "Add a function to generate tournament reports in:
1. JSON format (for data import)
2. CSV format (for Excel)
3. PDF format (for printing)

Include player statistics, final standings, and match results.
Show how to integrate with express."
```

### Player Comparison Tool
```
Prompt: "Create a tool to compare two players showing:
1. Head-to-head record
2. Performance stats comparison
3. Similar opponents analysis
4. Skill metrics side-by-side

Provide backend data aggregation and frontend UI."
```

---

## ✅ Testing & Quality

### Test Generation for Function
```
Prompt: "Generate comprehensive Jest unit tests for the 
calculatePlayerStats function. Include:
- Success cases
- Edge cases (new players, inactive players)
- Error handling
- Performance with large datasets
- Test data factories

Show expected coverage."
```

### Performance Testing
```
Prompt: "Create performance tests to ensure the grouping and matching 
algorithms work efficiently with:
- 50 players
- 100 players
- 500 players

Show how long each operation takes and identify bottlenecks."
```

### Integration Tests
```
Prompt: "Design integration tests for the complete tournament workflow:
1. Create players and add to categories
2. Generate groups for round 1
3. Record match results
4. Finish round and auto-rank
5. Generate groups for round 2

Provide test cases with sample data."
```

### Bug Fix Assistance
```
Prompt: "I have a bug where [describe the issue]. 
The error is [error message].
Looking at [file name] line [number], this is what's happening.
What's causing it and how do I fix it?"
```

---

## 🔧 Technical Improvements

### Performance Optimization
```
Prompt: "The generateRoundRobinMatches function gets slow with large groups. 
Current implementation: [performance details if known]
Suggest optimizations and show the refactored code with benchmarks."
```

### Code Refactoring
```
Prompt: "Review this code for:
1. Readability
2. Maintainability
3. Performance
4. Error handling
5. Adherence to project standards

Suggest improvements and provide refactored version:
[paste code here]"
```

### Security Review
```
Prompt: "Review the admin authentication system for security issues.
Check for:
- Input validation
- Password handling
- Session management
- API endpoint protection

Show vulnerabilities and fixes."
```

### Configuration Management
```
Prompt: "Create a configuration system to manage:
- Match victory points
- Game size limits
- Round duration
- Ranking weights

Show how to store and load configuration."
```

---

## 📱 Integration & API

### New API Endpoint
```
Prompt: "Create an API endpoint to:
[describe what it should do]

Requirements:
- Validate input parameters
- Handle errors gracefully
- Log important operations
- Return JSON responses

Show complete endpoint code including error handling."
```

### Data Synchronization
```
Prompt: "Create a function to sync frontend data with the server:
- Detect what changed locally
- Send only changed data
- Handle conflicts
- Update UI after sync

Provide complete implementation."
```

### CSV Import/Export
```
Prompt: "Add functionality to:
1. Export player list to CSV
2. Import player list from CSV
3. Validate imported data
4. Handle duplicate players

Show parsing logic and error handling."
```

---

## 🎓 Learning & Documentation

### Algorithm Explanation
```
Prompt: "Explain the current round-robin match generation algorithm in simple terms:
1. How does it work?
2. Why is it designed this way?
3. What are its limitations?
4. How would you improve it?

Include pseudocode and a step-by-step example."
```

### Best Practices Guide
```
Prompt: "What are the best practices for:
1. Ranking tournament players
2. Generating balanced groups
3. Scheduling matches to minimize conflicts
4. Handling ties in results

Provide references and code examples."
```

### Code Review Request
```
Prompt: "Please review this code and provide:
1. What's done well
2. Potential issues
3. Suggested improvements
4. Refactoring opportunities

[paste code]"
```

---

## 🚀 Advanced Usage

### A/B Testing Different Algorithms
```
Prompt: "Create a system to test multiple ranking algorithms:
1. Current algorithm (traditional wins/losses)
2. ELO-style algorithm
3. Weighted recent performance
4. Win percentage based

Generate test data and compare results of all algorithms."
```

### Machine Learning Integration
```
Prompt: "How could I use machine learning to:
1. Predict match outcomes
2. Identify player skill clusters
3. Recommend optimal group compositions
4. Detect unusual performance (cheating?)

Provide approach and simple implementation if possible."
```

### Real-time Updates
```
Prompt: "Design a system for real-time score updates:
1. WebSocket connection for live updates
2. Automatic ranking recalculation
3. UI updates as scores come in
4. Conflict resolution for concurrent updates

Show architecture and key code segments."
```

---

## 💡 Meta Prompts (Asking About Asking!)

### Project Architecture
```
Prompt: "Given our current architecture [describe], what would be 
the best way to add [feature]? Consider:
- Code organization
- Database changes if any
- API design
- Frontend integration
- Testing strategy"
```

### Decision Help
```
Prompt: "Should I implement [feature] as:
Option A: [description]
Option B: [description]
Option C: [description]

Compare trade-offs and recommend the best approach for a 
[size] user base."
```

### Roadmap Suggestions
```
Prompt: "What features would provide the most value to enhance 
a tournament management system? Prioritize by:
1. User impact
2. Implementation complexity
3. Dependencies

Consider our current capabilities: [list]"
```

---

## 📝 Template Prompt Structure

Use this structure for best results:

```
Background: [Describe current state]
Problem: [What needs to be done]
Requirements: [Specific needs]
Constraints: [Limitations/considerations]
Format: [How you want the response]

Example:
Background: We have a ranking system based on total wins/losses
Problem: Recent matches aren't weighted enough
Requirements: Matches in last 3 rounds should count 1.5x, provide tests
Constraints: Must work with existing data format, no new dependencies
Format: Complete code with comments, before/after comparison, unit tests
```

---

## 🎯 Pro Tips

1. **Be Specific:** Vague prompts = vague responses
2. **Show Context:** Share relevant code snippets
3. **State Goals:** What are you trying to achieve?
4. **Set Format:** How do you want the response?
5. **Ask Follow-ups:** "Show me how to test this" or "How would I integrate this?"

---

## Quick Reference: Copy-Paste Templates

### General Feature Request
```
"Add a [description] feature that [what it does]. 
Requirements: [specific needs]
Show: Complete code, where to integrate, tests, and UI changes."
```

### Algorithm Improvement
```
"Improve the [algorithm name] by [desired improvement].
Current behavior: [what it does now]
Desired behavior: [what you want]
Show: Algorithm logic, before/after comparison, performance metrics, tests."
```

### UI Enhancement
```
"Redesign [component] to [desired change].
Current design: [current state]
New design should: [requirements]
Show: HTML/CSS changes, responsive design, before/after mockup."
```

### Bug Fix Help
```
"I have a bug: [description]
Error: [error message if any]
Location: [file and line if known]
Impact: [what breaks]
Show: Root cause, fix, prevention strategy."
```

---

Save this file and come back to it for prompt ideas! The more specific your prompt, the better the AI's response.
