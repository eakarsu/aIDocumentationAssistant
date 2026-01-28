export const tutorialTemplate = {
  name: 'Tutorial',
  description: 'Learning-focused guide with code examples',
  type: 'TUTORIAL',
  content: `# Tutorial: [Topic Name]

## What You'll Learn

By the end of this tutorial, you will:

- Learning objective 1
- Learning objective 2
- Learning objective 3

## Prerequisites

- Basic knowledge of X
- Familiarity with Y
- Installed: Z (version X.X or higher)

## Time Required

Approximately 30 minutes

---

## Introduction

Explain what we're building and why it's useful.

---

## Part 1: Setting Up

### Step 1.1: Create the Project

\`\`\`bash
mkdir my-project
cd my-project
npm init -y
\`\`\`

### Step 1.2: Install Dependencies

\`\`\`bash
npm install package-name
\`\`\`

---

## Part 2: Building the Foundation

### Step 2.1: Create the Main File

Create a new file called \`index.js\`:

\`\`\`javascript
// index.js
const myModule = require('package-name');

// Your code here
console.log('Hello, World!');
\`\`\`

### Step 2.2: Understanding the Code

Let's break down what each part does:

- **Line 1:** Imports the module
- **Line 4:** Outputs a message

> **Note:** This is a simplified example for learning purposes.

---

## Part 3: Adding Features

### Step 3.1: Feature A

\`\`\`javascript
function featureA() {
  // Implementation
  return result;
}
\`\`\`

### Step 3.2: Feature B

\`\`\`javascript
function featureB(input) {
  // Implementation
  return processedInput;
}
\`\`\`

---

## Part 4: Testing

### Running the Application

\`\`\`bash
node index.js
\`\`\`

### Expected Output

\`\`\`
Hello, World!
Feature A result: ...
Feature B result: ...
\`\`\`

---

## Challenges

Try these exercises to reinforce your learning:

1. **Easy:** Modify the output message
2. **Medium:** Add a new feature that...
3. **Hard:** Implement error handling for...

---

## Summary

In this tutorial, you learned:

- Summary point 1
- Summary point 2
- Summary point 3

## Next Steps

- [Advanced Tutorial: Topic Name]
- [Reference: API Documentation]
- [Guide: Best Practices]

## Resources

- [Official Documentation](https://example.com)
- [GitHub Repository](https://github.com/example/repo)
`,
  isSystem: true,
};
