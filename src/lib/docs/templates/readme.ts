export const readmeTemplate = {
  name: 'README',
  description: 'Project overview template for repositories',
  type: 'README',
  content: `# Project Name

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()

Brief description of what this project does and its main purpose.

## Features

- Feature 1: Brief description
- Feature 2: Brief description
- Feature 3: Brief description

## Demo

[Link to live demo](https://example.com)

![Screenshot](screenshot.png)

## Installation

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0

### Quick Start

\`\`\`bash
# Clone the repository
git clone https://github.com/username/project-name.git

# Navigate to project directory
cd project-name

# Install dependencies
npm install

# Start the application
npm start
\`\`\`

## Usage

\`\`\`javascript
const projectName = require('project-name');

// Basic usage
projectName.doSomething();

// With options
projectName.doSomething({
  option1: 'value1',
  option2: 'value2'
});
\`\`\`

## Configuration

Create a \`.env\` file in the root directory:

\`\`\`env
API_KEY=your_api_key
DATABASE_URL=your_database_url
DEBUG=false
\`\`\`

| Variable | Description | Default |
|----------|-------------|---------|
| API_KEY | Your API key | - |
| DATABASE_URL | Database connection string | - |
| DEBUG | Enable debug mode | false |

## API Reference

### \`doSomething(options)\`

Description of the function.

**Parameters:**
- \`options\` (Object): Configuration options
  - \`option1\` (String): Description
  - \`option2\` (Number): Description

**Returns:** Description of return value

**Example:**
\`\`\`javascript
const result = projectName.doSomething({ option1: 'test' });
\`\`\`

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## Testing

\`\`\`bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test
\`\`\`

## Roadmap

- [x] Initial release
- [x] Feature A
- [ ] Feature B
- [ ] Feature C

See the [open issues](https://github.com/username/project-name/issues) for a full list of proposed features.

## License

Distributed under the MIT License. See \`LICENSE\` for more information.

## Contact

Your Name - [@twitter](https://twitter.com/yourhandle) - email@example.com

Project Link: [https://github.com/username/project-name](https://github.com/username/project-name)

## Acknowledgments

- [Library/Tool used](https://example.com)
- [Inspiration source](https://example.com)
- [Another resource](https://example.com)
`,
  isSystem: true,
};
