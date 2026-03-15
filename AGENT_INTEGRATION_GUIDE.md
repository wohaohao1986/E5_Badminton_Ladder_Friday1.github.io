# AI Agent Integration Guide for Badminton Ladder Project

This guide covers multiple approaches to integrate an AI agent into your project for:
- Adding new functions
- Modifying rank calculation algorithms
- Changing webpage styling
- Running unit tests

---

## **Option 1: VS Code Copilot Agent Customization (Recommended for Development)**

### Step 1: Create `.instructions.md` file

Create a file at the root of your project: `.instructions.md`

```markdown
# Badminton Ladder Project Instructions

## Project Overview
- **Type:** Node.js Express + Vanilla JavaScript badminton tournament management system
- **Main Files:**
  - `src/server.js` - Express server with API endpoints
  - `src/app.js` - Frontend UI logic
  - `src/utils/dataUtils.js` - Core business logic for ranking, grouping, matching
  - `src/utils/fileUtils.js` - File I/O utilities
  - Data files in `src/data/`: JSON files for persistence

## Code Quality Standards
- Use async/await for promises
- Always validate inputs
- Log important operations using `logToFile()`
- Maintain consistent error handling with try-catch blocks
- Keep functions focused and under 50 lines when possible

## Key Functions to Know
- `calculatePlayerStats()` - Calculates rankings and statistics
- `rearrangeGroups()` - Reorganizes groups (supports 4-5 player groups)
- `generateRoundRobinMatches()` - Creates match pairings
- `rerankPlayer()` - Updates player ranking based on results

## When Adding Features
1. Always update the corresponding route in `server.js`
2. Add unit tests in `test/` directory
3. Update documentation in comments
4. Test with sample data before deployment

## Styling Guidelines
- Use CSS classes for styling
- Keep colors consistent with the existing theme (green buttons, white text)
- Ensure responsive design for different screen sizes
- Use flexbox for layouts when possible
```

### Step 2: Create `.agent.md` for Custom Prompts

Create `.agent.md` at project root:

```markdown
---
model: claude-3.5-sonnet
temperature: 0.7
---

# Badminton Ladder AI Agent

You are an expert developer helping maintain and enhance a badminton tournament management system.

## Your Expertise
1. **Backend Development:** Node.js, Express, JSON data management
2. **Frontend Development:** Vanilla JavaScript, HTML/CSS, DOM manipulation
3. **Algorithm Development:** Ranking systems, tournament grouping, match generation
4. **Testing:** Unit tests, integration tests, test data generation

## When Making Changes
- Always explain the change before implementing
- Show before/after comparisons for algorithm changes
- Add logging for debugging
- Include validation for new inputs
- Update related functions if needed

## Code Generation Rules
- Maintain existing code style
- Use `logToFile()` for important events
- Handle errors gracefully
- Comment complex algorithms
```

### Step 3: Use the Agent in VS Code

With these files in place:
1. Open your project in VS Code
2. Open the Copilot chat (Ctrl+I on Windows)
3. Ask specific questions like:
   - "Add a function to calculate win percentage for each player"
   - "Modify the ranking algorithm to use weighted scoring"
   - "Create a new CSS theme with dark mode"
   - "Generate unit tests for the `rerankPlayer` function"

---

## **Option 2: Add an AI-Assisted API Endpoint**

### Step 1: Install Required Package

```bash
npm install axios dotenv
```

### Step 2: Create `.env` file

```
OPENAI_API_KEY=your_api_key_here
AI_API_BASE_URL=https://api.openai.com/v1
```

### Step 3: Add AI Helper Utility

Create `src/utils/aiAssistant.js`:

```javascript
const axios = require('axios');
require('dotenv').config();

const AIAssistant = {
  async generateCode(prompt, context) {
    try {
      const response = await axios.post(
        `${process.env.AI_API_BASE_URL}/chat/completions`,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a JavaScript/Node.js expert helping enhance a badminton tournament system. 
              Current project context: ${JSON.stringify(context)}`
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('AI API Error:', error.message);
      throw error;
    }
  },

  async suggestAlgorithm(algorithmName, requirements) {
    const prompt = `
    Please suggest an improved algorithm for: ${algorithmName}
    Requirements: ${requirements}
    Provide JavaScript code that can be integrated into our system.
    Include error handling and comments.
    `;
    return this.generateCode(prompt, {});
  },

  async generateTests(functionCode, functionName) {
    const prompt = `
    Generate comprehensive unit tests for this function:
    ${functionCode}
    
    Use Jest testing framework.
    Include edge cases and error scenarios.
    `;
    return this.generateCode(prompt, { functionName });
  }
};

module.exports = AIAssistant;
```

### Step 4: Add AI Endpoints to `server.js`

```javascript
const AIAssistant = require('./utils/aiAssistant');

// Get AI suggestions for algorithm improvement
app.post('/api/ai/suggest-algorithm', async (req, res) => {
  try {
    const { algorithmName, requirements } = req.body;
    logToFile(`AI request: Suggest algorithm for ${algorithmName}`);
    
    const suggestion = await AIAssistant.suggestAlgorithm(algorithmName, requirements);
    res.json({ success: true, suggestion });
  } catch (error) {
    logToFile(`AI Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate unit tests
app.post('/api/ai/generate-tests', async (req, res) => {
  try {
    const { functionCode, functionName } = req.body;
    logToFile(`AI request: Generate tests for ${functionName}`);
    
    const tests = await AIAssistant.generateTests(functionCode, functionName);
    res.json({ success: true, tests });
  } catch (error) {
    logToFile(`AI Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate CSS/styling suggestions
app.post('/api/ai/generate-styling', async (req, res) => {
  try {
    const { currentStyle, requirements } = req.body;
    const prompt = `
    Improve this CSS/styling:
    ${currentStyle}
    
    Requirements: ${requirements}
    Provide clean, modern CSS that follows best practices.
    `;
    
    const styling = await AIAssistant.generateCode(prompt, {});
    res.json({ success: true, styling });
  } catch (error) {
    logToFile(`AI Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## **Option 3: MCP (Model Context Protocol) Server**

### Step 1: Install MCP CLI

```bash
npm install -g @modelcontextprotocol/cli
```

### Step 2: Create MCP Server (`src/mcp-server.js`)

```javascript
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs');
const path = require('path');

const server = new Server({
  name: 'badminton-ladder-agent',
  version: '1.0.0',
});

// Tool: Analyze ranking algorithm
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_ranking_algorithm') {
    const currentAlgorithm = fs.readFileSync(
      path.join(__dirname, 'utils/dataUtils.js'),
      'utf8'
    );
    return {
      content: [
        {
          type: 'text',
          text: `Current ranking algorithm:\n${currentAlgorithm.substring(0, 1000)}...`
        }
      ]
    };
  }

  if (name === 'get_project_structure') {
    const structure = {
      'server.js': 'Express server setup',
      'app.js': 'Frontend logic',
      'utils/dataUtils.js': 'Core algorithms',
      'utils/fileUtils.js': 'File operations',
      'data/': 'JSON data storage'
    };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(structure, null, 2)
        }
      ]
    };
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }]
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Badminton Ladder MCP Server running');
}

main().catch(console.error);
```

### Step 3: Configure in `package.json`

```json
{
  "scripts": {
    "start": "node src/server.js",
    "mcp:server": "node src/mcp-server.js"
  }
}
```

---

## **Option 4: Testing with AI Assistance**

### Step 1: Set Up Jest Testing Framework

```bash
npm install --save-dev jest
```

### Step 2: Create `jest.config.js`

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/']
};
```

### Step 3: Add Test Directory

```bash
mkdir test
touch test/dataUtils.test.js
```

### Step 4: Sample Test with AI-Generated Content

```javascript
const { 
  calculatePlayerStats, 
  rerankPlayer 
} = require('../src/utils/dataUtils');

describe('Player Ranking Functions', () => {
  test('calculatePlayerStats should update all player statistics', () => {
    // Test implementation
  });

  test('rerankPlayer should correctly update ranking based on matches', () => {
    // Test implementation
  });
});
```

### Step 5: Run Tests

```bash
npm test
```

---

## **Implementation Recommendations**

### For Your Project, I Recommend:

1. **Primary: Option 1 (VS Code Customization)**
   - Easiest to implement
   - Works immediately with Copilot
   - No API costs or external dependencies
   - Perfect for development and learning

2. **Secondary: Option 4 (Testing)**
   - Add Jest for automated testing
   - Ensures code quality
   - AI can help generate test cases

3. **Advanced: Option 2 (API Endpoints)**
   - Add this later when you need automation
   - Useful for batch operations
   - Can suggest improvements to algorithms automatically

4. **Advanced: Option 3 (MCP Server)**
   - For enterprise deployments
   - Allows Claude to deeply understand your codebase
   - Setup is more complex

---

## **Quick Start: Implement Option 1 Now**

1. Create `.instructions.md` at project root
2. Create `.agent.md` at project root
3. Open project in VS Code
4. Press `Ctrl+I` to open Copilot chat
5. Ask: "Help me add a function to calculate player win rate"
6. Copilot will understand your project structure and provide context-aware solutions

---

## **Common AI Agent Prompts for Your Project**

```
"Add a function to calculate weighted ranking scores considering both 
recent performance and overall record. Use exponential weighting."

"Modify the rearrangeGroups function to use a skill-based algorithm 
that creates balanced groups."

"Create a dark mode CSS theme for the admin panel."

"Generate unit tests for the calculatePlayerStats function with 
edge cases for new players."

"Suggest how to optimize the group generation algorithm for large 
numbers of players (100+)."
```

---

## **Troubleshooting**

| Issue | Solution |
|-------|----------|
| Copilot not aware of project structure | Ensure `.instructions.md` is at root and VS Code recognizes it |
| AI suggestions don't match code style | Update `.instructions.md` with specific style guidelines |
| API rate limits exceeded | Implement request caching and queuing |
| Tests fail with AI-generated code | Review generated code and adjust prompts for more specific requirements |

---

## **Next Steps**

1. ✅ Create `.instructions.md` (5 minutes)
2. ✅ Create `.agent.md` (5 minutes)
3. ✅ Test with Copilot chat (10 minutes)
4. 📦 Add Jest testing when ready
5. 🚀 Add API endpoints for automation later

