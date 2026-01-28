export const userGuideTemplate = {
  name: 'User Guide',
  description: 'Step-by-step instructions with screenshots',
  type: 'USER_GUIDE',
  content: `# User Guide: [Feature Name]

## Introduction

Brief overview of what this guide covers and who it's for.

## Prerequisites

Before you begin, ensure you have:

- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

---

## Getting Started

### Step 1: Initial Setup

Describe the first step in detail.

> **Tip:** Include helpful tips in blockquotes like this.

### Step 2: Configuration

Explain configuration options.

\`\`\`yaml
# Example configuration
setting1: value1
setting2: value2
\`\`\`

### Step 3: First Use

Walk through the first-time user experience.

---

## Common Tasks

### Task 1: [Task Name]

1. First action
2. Second action
3. Third action

### Task 2: [Task Name]

1. First action
2. Second action
3. Third action

---

## Troubleshooting

### Issue: [Common Problem]

**Symptoms:** Describe what the user sees

**Solution:**
1. Step to resolve
2. Step to resolve

### Issue: [Another Problem]

**Symptoms:** Describe what the user sees

**Solution:**
1. Step to resolve
2. Step to resolve

---

## FAQ

**Q: Frequently asked question?**

A: Answer to the question.

**Q: Another common question?**

A: Answer to this question.

---

## Next Steps

- [Link to advanced guide]
- [Link to related feature]
- [Link to API documentation]

## Getting Help

If you need assistance:
- Check our [FAQ](#faq)
- Contact support at support@example.com
`,
  isSystem: true,
};
